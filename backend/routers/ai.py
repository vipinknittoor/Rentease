import os
import re
import math
import time
from collections import defaultdict
from datetime import date

import requests

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from google import genai
from sqlalchemy.orm import Session

from database.db import get_db
from models.user import User
from models.tenant import Tenant
from models.payment import Payment
from models.room import Room


load_dotenv()


router = APIRouter(
    prefix="/ai",
    tags=["AI"]
)


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not configured in .env"
    )

client = genai.Client(
    api_key=GEMINI_API_KEY
)

GEMINI_MODEL = "gemini-3-flash-preview"


GOOGLE_MAPS_API_KEY = os.getenv(
    "GOOGLE_MAPS_API_KEY"
)

if not GOOGLE_MAPS_API_KEY:
    raise RuntimeError(
        "GOOGLE_MAPS_API_KEY is not configured in .env"
    )


GOOGLE_NEARBY_SEARCH_URL = (
    "https://places.googleapis.com/v1/places:searchNearby"
)

GOOGLE_TEXT_SEARCH_URL = (
    "https://places.googleapis.com/v1/places:searchText"
)

GOOGLE_ROUTES_URL = (
    "https://routes.googleapis.com/directions/v2:computeRoutes"
)


PG_LATITUDE = 12.8122268
PG_LONGITUDE = 74.9308407

PG_ADDRESS = (
    "SAI PRABHA ROOMS /PG/ RENTAL APARTMENT, Green Valley, "
    "Kuntaliguli, PO Mangalagangothri, Konaje Village, "
    "Konaje Proper, Karnataka 574199"
)


SEARCH_RADIUS_METERS = 15_000

MAX_GOOGLE_RESULTS = 20

MAX_RETURNED_RESULTS = 5

MAX_ROAD_DISTANCE_KM = 10

ROUTES_LOOKUP_LIMIT = 8

MAX_LOCATION_SEARCHES_PER_USER_PER_DAY = 20



MAX_MESSAGE_LENGTH = 2_000

RATE_LIMIT_BURST_REQUESTS = 5
RATE_LIMIT_BURST_WINDOW_SECONDS = 10

RATE_LIMIT_USER_REQUESTS = 20
RATE_LIMIT_USER_WINDOW_SECONDS = 60

RATE_LIMIT_IP_REQUESTS = 60
RATE_LIMIT_IP_WINDOW_SECONDS = 60


user_rate_limits = defaultdict(list)

ip_rate_limits = defaultdict(list)

location_usage = defaultdict(dict)


def check_rate_limit(
    user_id: int,
    client_ip: str
) -> tuple[bool, str]:

    current_time = time.time()

    user_key = str(user_id)

    user_times = user_rate_limits[user_key]

    user_times[:] = [
        timestamp
        for timestamp in user_times
        if current_time - timestamp
        < RATE_LIMIT_BURST_WINDOW_SECONDS
    ]

    if len(user_times) >= RATE_LIMIT_BURST_REQUESTS:

        return (
            False,
            "Too many requests. Please wait a few seconds and try again."
        )

    user_minute_times = [
        timestamp
        for timestamp in user_times
        if current_time - timestamp
        < RATE_LIMIT_USER_WINDOW_SECONDS
    ]

    if len(user_minute_times) >= RATE_LIMIT_USER_REQUESTS:

        return (
            False,
            "You've sent too many requests. Please wait a minute and try again."
        )

    ip_times = ip_rate_limits[client_ip]

    ip_times[:] = [
        timestamp
        for timestamp in ip_times
        if current_time - timestamp
        < RATE_LIMIT_IP_WINDOW_SECONDS
    ]

    if len(ip_times) >= RATE_LIMIT_IP_REQUESTS:

        return (
            False,
            "Too many requests from this connection. Please try again later."
        )

    current_timestamp = time.time()

    user_rate_limits[user_key].append(
        current_timestamp
    )

    ip_rate_limits[client_ip].append(
        current_timestamp
    )

    return True, ""


def cleanup_rate_limits():

    current_time = time.time()

    users_to_delete = []

    for user_id, timestamps in user_rate_limits.items():

        timestamps[:] = [
            timestamp
            for timestamp in timestamps
            if current_time - timestamp
            < RATE_LIMIT_USER_WINDOW_SECONDS
        ]

        if not timestamps:

            users_to_delete.append(
                user_id
            )

    for user_id in users_to_delete:

        del user_rate_limits[user_id]

    ips_to_delete = []

    for ip, timestamps in ip_rate_limits.items():

        timestamps[:] = [
            timestamp
            for timestamp in timestamps
            if current_time - timestamp
            < RATE_LIMIT_IP_WINDOW_SECONDS
        ]

        if not timestamps:

            ips_to_delete.append(
                ip
            )

    for ip in ips_to_delete:

        del ip_rate_limits[ip]



def can_use_location_search(
    user_id: int
) -> bool:

    today = str(date.today())

    current_count = location_usage[user_id].get(
        today,
        0
    )

    if current_count >= MAX_LOCATION_SEARCHES_PER_USER_PER_DAY:

        return False

    location_usage[user_id][today] = (
        current_count + 1
    )

    return True


GOOGLE_PLACE_FIELDS = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.googleMapsUri",
    "places.primaryType",
    "places.types",
    "places.rating",
    "places.userRatingCount",
])



def is_location_question(
    message: str
) -> bool:

    text = message.lower().strip()

    patterns = [

        r"\bnearest\b",
        r"\bnearby\b",
        r"\bclosest\b",
        r"\bnear me\b",
        r"\baround me\b",
        r"\bclose to me\b",
        r"\bin my area\b",
        r"\bin my location\b",
        r"\bnear my location\b",
        r"\bhow far\b",
        r"\bdistance to\b",
        r"\bfind .* near\b",
        r"\bfind .* nearby\b",
        r"\bfind .* around\b",
        r"\bshow .* near\b",
        r"\bshow .* nearby\b",
        r"\bsearch .* near\b",
        r"\bsearch .* nearby\b",
    ]

    return any(
        re.search(
            pattern,
            text
        )
        for pattern in patterns
    )

def extract_place_query(
    message: str
) -> str:

    text = message.strip()

    text = re.sub(
        r"^(where is|where are|find|show me|show|search for|search|locate)\s+",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"^how far is\s+",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"^how far are\s+",
        "",
        text,
        flags=re.IGNORECASE
    )

    patterns = [

        r"\bnearest\b",
        r"\bclosest\b",
        r"\bnearby\b",
        r"\bnear me\b",
        r"\baround me\b",
        r"\bclose to me\b",
        r"\bin my area\b",
        r"\bin my location\b",
        r"\bnear my location\b",
        r"\bnear\b",
    ]

    for pattern in patterns:

        text = re.sub(
            pattern,
            "",
            text,
            flags=re.IGNORECASE
        )

    text = text.replace(
        "?",
        ""
    )

    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    if not text:

        return "places"

    return text


def normalize_query(
    query: str
) -> str:

    query = query.lower().strip()

    replacements = {

        "gyms": "gym",
        "hospitals": "hospital",
        "restaurants": "restaurant",
        "cafes": "cafe",
        "hotels": "hotel",
        "pharmacies": "pharmacy",
        "banks": "bank",
        "schools": "school",
        "colleges": "college",
        "universities": "university",
        "supermarkets": "supermarket",
        "malls": "shopping mall",
        "petrol pumps": "petrol pump",
        "gas stations": "gas station",

        "xerox shops": "xerox shop",
        "xerox stores": "xerox shop",
        "xerox centers": "xerox shop",
        "xerox centres": "xerox shop",
        "xerox center": "xerox shop",
        "xerox centre": "xerox shop",

        "copy shops": "xerox shop",
        "copy shop": "xerox shop",
        "photocopy shops": "xerox shop",
        "photocopy shop": "xerox shop",
        "photocopy centers": "xerox shop",
        "photocopy centres": "xerox shop",
        "photocopy center": "xerox shop",
        "photocopy centre": "xerox shop",
    }

    for old, new in replacements.items():

        if query == old:

            return new

    return query

PLACE_TYPE_MAP = {

    "gym": ["gym"],
    "hospital": ["hospital"],
    "restaurant": ["restaurant"],
    "cafe": ["cafe"],
    "hotel": ["hotel"],
    "pharmacy": ["pharmacy"],
    "bank": ["bank"],
    "school": ["school"],
    "university": ["university"],
    "supermarket": ["supermarket"],
    "shopping mall": ["shopping_mall"],
    "gas station": ["gas_station"],
    "petrol pump": ["gas_station"],
    "airport": ["airport"],
    "bus station": ["bus_station"],
    "train station": ["train_station"],
    "railway station": ["train_station"],
    "police station": ["police"],
    "fire station": ["fire_station"],
    "post office": ["post_office"],
    "bakery": ["bakery"],
    "dentist": ["dentist"],
    "doctor": ["doctor"],
    "clinic": ["medical_clinic"],
    "medical clinic": ["medical_clinic"],
    "movie theater": ["movie_theater"],
    "cinema": ["movie_theater"],
    "park": ["park"],
    "parking": ["parking"],
    "car wash": ["car_wash"],
    "car repair": ["car_repair"],
    "electrician": ["electrician"],
    "plumber": ["plumber"],
    "library": ["library"],
    "museum": ["museum"],
    "temple": ["hindu_temple"],
    "church": ["church"],
    "mosque": ["mosque"],
    "stadium": ["stadium"],
}


def get_google_place_types(
    query: str
):

    normalized = normalize_query(
        query
    )

    if normalized in PLACE_TYPE_MAP:

        return PLACE_TYPE_MAP[
            normalized
        ]

    if "engineering college" in normalized:

        return ["university"]

    if "medical college" in normalized:

        return ["university"]

    if "degree college" in normalized:

        return ["university"]

    if normalized == "college":

        return ["university"]

    if "gym" in normalized:

        return ["gym"]

    if "hospital" in normalized:

        return ["hospital"]

    if "restaurant" in normalized:

        return ["restaurant"]

    if "cafe" in normalized:

        return ["cafe"]

    return []


def place_matches_query(
    place,
    query: str
) -> bool:

    normalized = normalize_query(
        query
    )

    display_name = place.get(
        "displayName",
        {}
    )

    name = display_name.get(
        "text",
        ""
    ).lower()

    address = place.get(
        "formattedAddress",
        ""
    ).lower()

    primary_type = place.get(
        "primaryType",
        ""
    ).lower()

    types = [
        str(item).lower()
        for item in place.get(
            "types",
            []
        )
    ]

    all_text = (
        f"{name} "
        f"{address} "
        f"{primary_type} "
        f"{' '.join(types)}"
    )

    if normalized == "xerox shop":

        xerox_keywords = [

            "xerox",
            "photocopy",
            "photo copy",
            "copy center",
            "copy centre",
            "copy shop",
            "copying",
            "printing",
            "print shop",
            "print center",
            "print centre",
            "digital seva",
            "cyber center",
            "cyber centre",
            "document printing",
            "computer center",
            "computer centre",
        ]

        return any(
            keyword in all_text
            for keyword in xerox_keywords
        )

    if normalized == "hospital":

        excluded_keywords = [

            "medical center",
            "medical centre",
            "health center",
            "health centre",
            "health care",
            "healthcare",
            "clinic",
            "dental",
            "ayurvedic",
            "dispensary",
            "pharmacy",
            "diagnostic",
            "diagnostics",
            "laboratory",
            "lab",
            "physiotherapy",
            "physio",
            "wellness",
            "optical",
            "eye care",
            "healthcare center",
            "healthcare centre",
        ]

        if any(
            keyword in name
            for keyword in excluded_keywords
        ):

            return False

        hospital_name_keywords = [

            "hospital",
            "general hospital",
            "government hospital",
            "district hospital",
            "community hospital",
            "multispeciality hospital",
            "multi speciality hospital",
            "multispecialty hospital",
            "multi specialty hospital",
            "speciality hospital",
            "specialty hospital",
            "mission hospital",
            "memorial hospital",
            "medical college hospital",
            "teaching hospital",
        ]

        has_hospital_name = any(
            keyword in name
            for keyword in hospital_name_keywords
        )

        if not has_hospital_name:

            return False

        if "hospital" in name:

            return True

        if primary_type == "hospital":

            return True

        if "hospital" in types:

            return True

        return False

    if normalized == "pharmacy":

        pharmacy_keywords = [
            "pharmacy",
            "chemist",
            "drug store",
        ]

        return (
            primary_type == "pharmacy"
            or
            any(
                keyword in all_text
                for keyword in pharmacy_keywords
            )
        )

    if normalized == "gym":

        return (
            primary_type == "gym"
            or
            "gym" in all_text
            or
            "fitness" in all_text
        )

    google_types = get_google_place_types(
        normalized
    )

    if google_types:

        if primary_type in google_types:

            return True

        if any(
            place_type in google_types
            for place_type in types
        ):

            return True

        return False

    return True

def google_nearby_search(
    latitude: float,
    longitude: float,
    place_types
):

    headers = {

        "Content-Type":
            "application/json",

        "X-Goog-Api-Key":
            GOOGLE_MAPS_API_KEY,

        "X-Goog-FieldMask":
            GOOGLE_PLACE_FIELDS,
    }

    payload = {

        "includedTypes":
            place_types,

        "maxResultCount":
            MAX_GOOGLE_RESULTS,

        "rankPreference":
            "DISTANCE",

        "languageCode":
            "en",

        "regionCode":
            "IN",

        "locationRestriction": {

            "circle": {

                "center": {

                    "latitude":
                        latitude,

                    "longitude":
                        longitude
                },

                "radius":
                    SEARCH_RADIUS_METERS
            }
        }
    }

    try:

        response = requests.post(
            GOOGLE_NEARBY_SEARCH_URL,
            headers=headers,
            json=payload,
            timeout=20
        )

        if response.status_code != 200:

            print(
                "GOOGLE NEARBY ERROR:",
                response.text
            )

            return []

        return response.json().get(
            "places",
            []
        )

    except Exception as error:

        print(
            "GOOGLE NEARBY ERROR:",
            repr(error)
        )

        return []

def google_text_search(
    latitude: float,
    longitude: float,
    query: str
):

    headers = {

        "Content-Type":
            "application/json",

        "X-Goog-Api-Key":
            GOOGLE_MAPS_API_KEY,

        "X-Goog-FieldMask":
            GOOGLE_PLACE_FIELDS,
    }

    search_query = query

    if query == "xerox shop":

        search_query = (
            "Xerox photocopy printing shop"
        )

    elif query == "hospital":

        search_query = "hospital"

    payload = {

        "textQuery":
            search_query,

        "languageCode":
            "en",

        "regionCode":
            "IN",

        "pageSize":
            MAX_GOOGLE_RESULTS,

        "rankPreference":
            "DISTANCE",

        "locationBias": {

            "circle": {

                "center": {

                    "latitude":
                        latitude,

                    "longitude":
                        longitude
                },

                "radius":
                    SEARCH_RADIUS_METERS
            }
        }
    }

    try:

        response = requests.post(
            GOOGLE_TEXT_SEARCH_URL,
            headers=headers,
            json=payload,
            timeout=20
        )

        if response.status_code != 200:

            print(
                "GOOGLE TEXT ERROR:",
                response.text
            )

            return []

        return response.json().get(
            "places",
            []
        )

    except Exception as error:

        print(
            "GOOGLE TEXT ERROR:",
            repr(error)
        )

        return []


def haversine_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:

    earth_radius_km = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(
        lat2 - lat1
    )

    delta_lambda = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(delta_phi / 2) ** 2
        +
        math.cos(phi1)
        *
        math.cos(phi2)
        *
        math.sin(delta_lambda / 2) ** 2
    )

    c = 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

    return earth_radius_km * c



def calculate_google_road_distance(
    origin_latitude: float,
    origin_longitude: float,
    destination_latitude: float,
    destination_longitude: float
):

    headers = {

        "Content-Type":
            "application/json",

        "X-Goog-Api-Key":
            GOOGLE_MAPS_API_KEY,

        "X-Goog-FieldMask":
            "routes.distanceMeters,routes.duration",
    }

    payload = {

        "origin": {

            "location": {

                "latLng": {

                    "latitude":
                        origin_latitude,

                    "longitude":
                        origin_longitude
                }
            }
        },

        "destination": {

            "location": {

                "latLng": {

                    "latitude":
                        destination_latitude,

                    "longitude":
                        destination_longitude
                }
            }
        },

        "travelMode":
            "DRIVE",

        "routingPreference":
            "TRAFFIC_UNAWARE",
    }

    try:

        response = requests.post(
            GOOGLE_ROUTES_URL,
            headers=headers,
            json=payload,
            timeout=20
        )

        if response.status_code != 200:

            print(
                "GOOGLE ROUTES ERROR:",
                response.text
            )

            return None

        routes = response.json().get(
            "routes",
            []
        )

        if not routes:

            return None

        route = routes[0]

        distance_meters = route.get(
            "distanceMeters"
        )

        duration = route.get(
            "duration"
        )

        if distance_meters is None:

            return None

        duration_minutes = None

        if duration:

            try:

                seconds = float(
                    duration.rstrip("s")
                )

                duration_minutes = round(
                    seconds / 60
                )

            except Exception:

                duration_minutes = None

        return {

            "distance_meters":
                distance_meters,

            "distance_km":
                round(
                    distance_meters / 1000,
                    2
                ),

            "duration_minutes":
                duration_minutes
        }

    except Exception as error:

        print(
            "GOOGLE ROUTES ERROR:",
            repr(error)
        )

        return None



def create_google_directions_url(
    destination_latitude: float,
    destination_longitude: float
) -> str:

    origin = (
        f"{PG_LATITUDE},"
        f"{PG_LONGITUDE}"
    )

    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={origin}"
        f"&destination={destination_latitude},{destination_longitude}"
        "&travelmode=driving"
    )

def convert_google_place(
    place,
    route,
    origin_latitude,
    origin_longitude
):

    display_name = place.get(
        "displayName",
        {}
    )

    name = display_name.get(
        "text"
    )

    location = place.get(
        "location",
        {}
    )

    latitude = location.get(
        "latitude"
    )

    longitude = location.get(
        "longitude"
    )

    if not name or latitude is None or longitude is None:

        return None

    if route is None:

        return None

    directions_url = create_google_directions_url(
        float(latitude),
        float(longitude)
    )

    return {

        "name":
            name,

        "address":
            place.get(
                "formattedAddress",
                ""
            ),

        "latitude":
            latitude,

        "longitude":
            longitude,

        "distance":
            route["distance_km"],

        "distance_km":
            route["distance_km"],

        "distance_meters":
            route["distance_meters"],

        "duration_minutes":
            route.get(
                "duration_minutes"
            ),

        "distance_is_estimated":
            route.get(
                "distance_is_estimated",
                False
            ),

        "rating":
            place.get(
                "rating"
            ),

        "user_rating_count":
            place.get(
                "userRatingCount"
            ),

        "primary_type":
            place.get(
                "primaryType"
            ),

        "types":
            place.get(
                "types",
                []
            ),

        "google_maps_url":
            place.get(
                "googleMapsUri"
            ),

        "directions_url":
            directions_url,

        "place_id":
            place.get(
                "id"
            )
    }

def find_nearby_places(
    latitude: float,
    longitude: float,
    query: str
):

    place_types = get_google_place_types(
        query
    )

    if place_types:

        google_places = google_nearby_search(
            latitude,
            longitude,
            place_types
        )

    else:

        google_places = []

    if not google_places:

        google_places = google_text_search(
            latitude,
            longitude,
            query
        )

    if not google_places:

        return []

    seen_place_ids = set()

    candidates = []

    for place in google_places:

        place_id = place.get(
            "id"
        )

        if (
            place_id
            and
            place_id in seen_place_ids
        ):

            continue

        if place_id:

            seen_place_ids.add(
                place_id
            )

        if not place_matches_query(
            place,
            query
        ):

            continue

        location = place.get(
            "location",
            {}
        )

        place_latitude = location.get(
            "latitude"
        )

        place_longitude = location.get(
            "longitude"
        )

        display_name = place.get(
            "displayName",
            {}
        )

        name = display_name.get(
            "text",
            "Unknown place"
        )

        if (
            place_latitude is None
            or
            place_longitude is None
        ):

            continue

        straight_line_km = haversine_distance_km(

            PG_LATITUDE,

            PG_LONGITUDE,

            float(place_latitude),

            float(place_longitude)
        )

        candidates.append({

            "place":
                place,

            "place_id":
                place_id,

            "name":
                name,

            "latitude":
                float(place_latitude),

            "longitude":
                float(place_longitude),

            "straight_line_km":
                straight_line_km
        })

    candidates.sort(
        key=lambda candidate:
            candidate["straight_line_km"]
    )

    candidates_for_routing = candidates[
        :ROUTES_LOOKUP_LIMIT
    ]

    results = []

    for candidate in candidates_for_routing:

        place = candidate["place"]

        place_id = candidate["place_id"]

        name = candidate["name"]

        place_latitude = candidate["latitude"]

        place_longitude = candidate["longitude"]

        route = calculate_google_road_distance(

            PG_LATITUDE,

            PG_LONGITUDE,

            place_latitude,

            place_longitude
        )

        if route is None:

            straight_line_km = candidate[
                "straight_line_km"
            ]

            route = {

                "distance_meters":
                    round(
                        straight_line_km * 1000
                    ),

                "distance_km":
                    round(
                        straight_line_km,
                        2
                    ),

                "duration_minutes":
                    None,

                "distance_is_estimated":
                    True
            }

        else:

            route[
                "distance_is_estimated"
            ] = False

        road_distance = route[
            "distance_km"
        ]

        if road_distance > MAX_ROAD_DISTANCE_KM:

            continue

        converted = convert_google_place(
            place,
            route,
            PG_LATITUDE,
            PG_LONGITUDE
        )

        if converted:

            results.append(
                converted
            )

    results.sort(
        key=lambda place:
            place["distance_km"]
    )

    return results[
        :MAX_RETURNED_RESULTS
    ]

def create_places_answer(
    places,
    query
):

    if not places:

        return (
            f"I couldn't find any {query} "
            "within 10 km by road from "
            "your PG."
        )

    answer = (
        f"Here are the nearest "
        f"{query} from your PG:\n\n"
    )

    for index, place in enumerate(
        places,
        start=1
    ):

        answer += (
            f"{index}. "
            f"{place['name']} "
            f"— {place['distance_km']} km away"
        )

        if place.get(
            "distance_is_estimated",
            False
        ):

            answer += " (approx.)"

        elif place.get(
            "duration_minutes"
        ) is not None:

            answer += (
                f" — approximately "
                f"{place['duration_minutes']} min"
            )

        if place.get(
            "rating"
        ) is not None:

            answer += (
                f"\n   Rating: "
                f"{place['rating']}"
            )

            review_count = place.get(
                "user_rating_count"
            )

            if review_count:

                answer += (
                    f" "
                    f"({review_count} reviews)"
                )

        if place.get(
            "address"
        ):

            answer += (
                f"\n   Address: "
                f"{place['address']}"
            )

        if place.get(
            "directions_url"
        ):

            answer += (
                f"\n   Get directions: "
                f"{place['directions_url']}"
            )

        answer += "\n\n"

    answer += (
        "Distances and directions are "
        "calculated from your PG location."
    )

    return answer

def handle_location_search(
    message: str,
    user_id: int,
    latitude=None,
    longitude=None
):

    search_latitude = PG_LATITUDE

    search_longitude = PG_LONGITUDE

    if not can_use_location_search(
        user_id
    ):

        return {

            "type":
                "location_limit",

            "answer": (
                "You've reached today's "
                "nearby-place search limit. "
                "Please try again tomorrow."
            )
        }

    query = extract_place_query(
        message
    )

    query = normalize_query(
        query
    )

    places = find_nearby_places(

        search_latitude,

        search_longitude,

        query
    )

    answer = create_places_answer(
        places,
        query
    )

    return {

        "type":
            "places",

        "place_type":
            query,

        "places":
            places,

        "answer":
            answer,

        "user_location": {

            "latitude":
                PG_LATITUDE,

            "longitude":
                PG_LONGITUDE
        }
    }

def get_payment_status(
    payment
) -> str:

    status = getattr(
        payment,
        "status",
        ""
    )

    if status is None:

        return ""

    return str(
        status
    ).strip().lower()


def get_pending_payments(
    payments
):

    return [
        payment
        for payment in payments
        if get_payment_status(payment)
        == "pending"
    ]


def build_payment_context(
    payments
):

    if not payments:

        return (
            "NO PAYMENT RECORDS EXIST.\n"
            "There are currently no bill/payment records "
            "available in the payment history.\n"
            "Do NOT treat tenant profile amounts such as "
            "monthly rent, electricity bill, or extra bill "
            "as pending when there are no Payment records."
        )

    payment_context = ""

    for payment in payments:

        payment_context += f"""
Billing Month:
{getattr(payment, "billing_month", "N/A")}

Monthly Rent:
₹{getattr(payment, "monthly_rent", 0)}

Electricity Bill:
₹{getattr(payment, "electricity_bill", 0)}

Extra Bill:
₹{getattr(payment, "extra_bill", 0)}

Carry Forward:
₹{getattr(payment, "carry_forward_amount", 0)}

Total Amount:
₹{getattr(payment, "total_amount", 0)}

Status:
{getattr(payment, "status", "N/A")}

---
"""

    return payment_context

def build_tenant_context(
    tenant,
    payments
):

    payment_context = build_payment_context(
        payments
    )

    pending_payments = get_pending_payments(
        payments
    )

    if pending_payments:

        pending_context = (
            "PENDING PAYMENT RECORDS EXIST.\n"
            "Only the following Payment records can be "
            "described as pending:\n\n"
        )

        for payment in pending_payments:

            pending_context += f"""
Billing Month:
{getattr(payment, "billing_month", "N/A")}

Monthly Rent:
₹{getattr(payment, "monthly_rent", 0)}

Electricity Bill:
₹{getattr(payment, "electricity_bill", 0)}

Extra Bill:
₹{getattr(payment, "extra_bill", 0)}

Carry Forward:
₹{getattr(payment, "carry_forward_amount", 0)}

Total Amount:
₹{getattr(payment, "total_amount", 0)}

Status:
{getattr(payment, "status", "N/A")}

---
"""

    else:

        pending_context = (
            "NO PENDING PAYMENT RECORDS EXIST.\n"
            "Do NOT say that the tenant has a pending bill.\n"
            "The tenant's current monthly rent, electricity "
            "bill, or extra bill fields are NOT pending bills "
            "unless they are represented by a Payment record "
            "with status 'pending'."
        )

    return f"""
You are RentEase AI assistant.

The logged-in user is a TENANT.

TENANT INFORMATION:

Name:
{getattr(tenant, "full_name", "N/A")}

Phone:
{getattr(tenant, "phone", "N/A")}

Email:
{getattr(tenant, "email", "N/A")}

Room Number:
{getattr(tenant, "room_number", "N/A")}

Monthly Rent:
₹{getattr(tenant, "monthly_rent", 0)}

Previous Electricity Reading:
{getattr(tenant, "previous_reading", "N/A")}

Current Electricity Reading:
{getattr(tenant, "current_reading", "N/A")}

Electricity Units:
{getattr(tenant, "electricity_units", "N/A")}

Electricity Bill:
₹{getattr(tenant, "electricity_bill", 0)}

Extra Bill:
₹{getattr(tenant, "extra_bill", 0)}

Deposit:
₹{getattr(tenant, "deposit", 0)}

Join Date:
{getattr(tenant, "join_date", "N/A")}

Status:
{getattr(tenant, "status", "N/A")}

PAYMENT HISTORY:

{payment_context}

PENDING PAYMENT STATUS:

{pending_context}

CRITICAL PAYMENT RULE:

A tenant profile amount is NOT automatically a pending bill.

Only Payment records with status = "pending" represent
pending bills.

If there are ZERO Payment records, there is ZERO pending
payment according to the payment history.

If all bills have been deleted from payment history, say:

"There are no pending bills in your payment history."

Do NOT calculate a pending bill from:

Tenant.monthly_rent
Tenant.electricity_bill
Tenant.extra_bill
Tenant.current_reading
Tenant.previous_reading

unless those amounts are present in a Payment record
whose status is "pending".

RULES:

1. Use the provided tenant information.

2. Never invent tenant information.

3. If information is unavailable, clearly say so.

4. Never reveal information about other tenants.

5. Keep answers clear and easy to understand.

6. The tenant may ask about:

Rent
Room
Electricity
Extra Bill
Bills
Payments
Deposit
Join date
Rental information
General questions
"""

def build_owner_context(
    tenants,
    rooms,
    payments
):

    tenant_context = ""

    for tenant in tenants:

        tenant_context += f"""
Tenant ID:
{getattr(tenant, "id", "N/A")}

Name:
{getattr(tenant, "full_name", "N/A")}

Phone:
{getattr(tenant, "phone", "N/A")}

Email:
{getattr(tenant, "email", "N/A")}

Room:
{getattr(tenant, "room_number", "N/A")}

Monthly Rent:
₹{getattr(tenant, "monthly_rent", 0)}

Electricity Units:
{getattr(tenant, "electricity_units", "N/A")}

Electricity Bill:
₹{getattr(tenant, "electricity_bill", 0)}

Extra Bill:
₹{getattr(tenant, "extra_bill", 0)}

Deposit:
₹{getattr(tenant, "deposit", 0)}

Join Date:
{getattr(tenant, "join_date", "N/A")}

Status:
{getattr(tenant, "status", "N/A")}

---
"""

    if not tenant_context:

        tenant_context = (
            "No tenants found."
        )

    room_context = ""

    for room in rooms:

        room_context += f"""
Room ID:
{getattr(room, "id", "N/A")}

Room Number:
{getattr(room, "room_number", "N/A")}

Floor:
{getattr(room, "floor", "N/A")}

Monthly Rent:
₹{getattr(room, "monthly_rent", 0)}

Status:
{getattr(room, "status", "N/A")}

---
"""

    if not room_context:

        room_context = (
            "No rooms found."
        )

    payment_context = build_payment_context(
        payments
    )

    pending_payments = get_pending_payments(
        payments
    )

    if pending_payments:

        pending_owner_context = (
            "PENDING PAYMENT RECORDS EXIST.\n"
            "Only Payment records with status "
            "'pending' are pending bills."
        )

    else:

        pending_owner_context = (
            "NO PENDING PAYMENT RECORDS EXIST.\n"
            "Do not report tenant profile amounts as "
            "pending bills."
        )

    return f"""
You are RentEase AI assistant.

The logged-in user is the OWNER.

You can answer questions about
the owner's RentEase property,
tenants, rooms, bills and payments.

TENANTS:

{tenant_context}

ROOMS:

{room_context}

PAYMENTS:

{payment_context}

PENDING PAYMENT STATUS:

{pending_owner_context}

CRITICAL PAYMENT RULE:

Pending bills must be determined ONLY from Payment
records where status is "pending".

Tenant.monthly_rent,
Tenant.electricity_bill,
and Tenant.extra_bill
must NOT be reported as pending merely because those
values exist in the tenant profile.

If there are no Payment records, there are no pending
payment records.

If all bills have been deleted from payment history,
do not report a pending bill for that tenant.

RULES:

1. Use the provided RentEase data.

2. Never invent information.

3. If information is unavailable, clearly say so.

4. The owner is authorized to view property and
tenant information.

5. Keep answers clear and easy to understand.

6. You may answer questions about:

Number of tenants
Active tenants
Tenant information
Rooms
Vacant rooms
Occupied rooms
Rent
Electricity
Extra Bill
Payments
Pending payments
Paid payments
Bills
General questions
"""


def is_pending_bill_question(
    message: str
) -> bool:

    text = message.lower().strip()

    patterns = [

        r"\bpending bill\b",
        r"\bpending bills\b",
        r"\bany pending\b",
        r"\bany bill pending\b",
        r"\bany bills pending\b",
        r"\bpending payment\b",
        r"\bpending payments\b",
        r"\bpayment pending\b",
        r"\bpayments pending\b",
        r"\bwhat do i owe\b",
        r"\bhow much do i owe\b",
        r"\bhow much is pending\b",
        r"\bwhat is pending\b",
        r"\bdo i have any pending\b",
        r"\bis there any pending\b",
        r"\bdo i have a pending\b",
        r"\bunpaid bill\b",
        r"\bunpaid bills\b",
        r"\bunpaid payment\b",
        r"\bunpaid payments\b",
    ]

    return any(
        re.search(
            pattern,
            text
        )
        for pattern in patterns
    )


def create_pending_bill_answer(
    tenant,
    payments
):

    pending_payments = get_pending_payments(
        payments
    )

    tenant_name = getattr(
        tenant,
        "full_name",
        "you"
    )

    if not pending_payments:

        return (
            f"No, {tenant_name}. "
            "There are no pending bills in your "
            "payment history."
        )

    total_pending = 0.0

    answer = (
        f"Yes, {tenant_name}. "
        "You have the following pending bill(s):\n\n"
    )

    for payment in pending_payments:

        billing_month = getattr(
            payment,
            "billing_month",
            "N/A"
        )

        monthly_rent = float(
            getattr(
                payment,
                "monthly_rent",
                0
            ) or 0
        )

        electricity_bill = float(
            getattr(
                payment,
                "electricity_bill",
                0
            ) or 0
        )

        extra_bill = float(
            getattr(
                payment,
                "extra_bill",
                0
            ) or 0
        )

        carry_forward = float(
            getattr(
                payment,
                "carry_forward_amount",
                0
            ) or 0
        )

        total_amount = float(
            getattr(
                payment,
                "total_amount",
                0
            ) or 0
        )

        total_pending += total_amount

        answer += (
            f"{billing_month}\n"
            f"Monthly Rent: ₹{monthly_rent:,.2f}\n"
            f"Electricity Bill: ₹{electricity_bill:,.2f}\n"
            f"Extra Bill: ₹{extra_bill:,.2f}\n"
            f"Carry Forward: ₹{carry_forward:,.2f}\n"
            f"Total: ₹{total_amount:,.2f}\n\n"
        )

    answer += (
        f"Total pending amount: "
        f"₹{total_pending:,.2f}"
    )

    return answer

@router.post("/chat")
def chat_with_ai(
    data: dict,
    request: Request,
    db: Session = Depends(get_db)
):

    message = data.get(
        "message",
        ""
    ).strip()

    user_id = data.get(
        "user_id"
    )

    latitude = data.get(
        "latitude"
    )

    longitude = data.get(
        "longitude"
    )

    if not message:

        return {
            "answer":
                "Please enter a question."
        }

    if len(message) > MAX_MESSAGE_LENGTH:

        return JSONResponse(
            status_code=413,
            content={
                "type": "error",
                "answer": (
                    "Your message is too long. "
                    f"Please keep it under "
                    f"{MAX_MESSAGE_LENGTH} characters."
                )
            }
        )

    if not user_id:

        return {
            "answer":
                "Unable to identify the logged-in user."
        }

    try:

        user_id = int(
            user_id
        )

    except (
        ValueError,
        TypeError
    ):

        return {
            "answer":
                "Invalid user ID."
        }

    client_ip = "unknown"

    if request.client:

        client_ip = request.client.host

    allowed, rate_limit_message = check_rate_limit(
        user_id,
        client_ip
    )

    if not allowed:

        print(
            "RATE LIMIT BLOCKED:",
            "user_id=",
            user_id,
            "ip=",
            client_ip
        )

        return JSONResponse(
            status_code=429,
            content={
                "type": "rate_limit",
                "answer": rate_limit_message
            }
        )

    if len(user_rate_limits) > 1000:

        cleanup_rate_limits()

    if is_location_question(
        message
    ):

        return handle_location_search(

            message,

            user_id,

            latitude,

            longitude
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if not user:

        return {
            "answer":
                "User not found."
        }

    if user.role == "tenant":

        tenant = (
            db.query(Tenant)
            .filter(
                Tenant.user_id == user.id
            )
            .first()
        )

        if not tenant:

            context = """
You are RentEase AI.

The logged-in user is a tenant,
but no tenant profile was found.

Answer general questions normally.

Do not invent RentEase information.
"""

        else:

            payments = (
                db.query(Payment)
                .filter(
                    Payment.tenant_id
                    == tenant.id
                )
                .order_by(
                    Payment.billing_month.desc()
                )
                .all()
            )

            if is_pending_bill_question(
                message
            ):

                return {
                    "type":
                        "text",

                    "answer":
                        create_pending_bill_answer(
                            tenant,
                            payments
                        )
                }

            context = (
                build_tenant_context(
                    tenant,
                    payments
                )
            )

    elif user.role == "owner":

        tenants = (
            db.query(Tenant)
            .all()
        )

        rooms = (
            db.query(Room)
            .all()
        )

        payments = (
            db.query(Payment)
            .all()
        )

        context = (
            build_owner_context(
                tenants,
                rooms,
                payments
            )
        )

    else:

        context = """
You are RentEase AI.

The user's role is unknown.

Answer only general questions.

Do not reveal or invent RentEase information.
"""


    prompt = f"""
{context}

USER QUESTION:

{message}

INSTRUCTIONS:

Answer the user's question clearly
and naturally.

If the question is about RentEase,
use the provided RentEase data.

If the question is a general question,
answer normally.

Never invent database information.

IMPORTANT PAYMENT RULE:

A tenant's current profile values are NOT
automatically pending bills.

Only Payment records with status = "pending"
are pending bills.

If there are no Payment records,
there are no pending bills in payment history.

Do not calculate a pending bill from:

Tenant.monthly_rent
Tenant.electricity_bill
Tenant.extra_bill

unless those values belong to a Payment record
with status = "pending".

Keep the answer concise and easy to understand.

RESPONSE FORMATTING RULES:

Return plain text only.

Do not use Markdown formatting.

Do not use asterisks (*) for bold or italic text.

Do not use hyphens (-) as bullet points.

Do not use Markdown headings.

Do not use backticks.

Do not use Markdown links.

Use simple sentences and line breaks only.

Do not add emojis unless the user explicitly asks for them.

Do not use decorative symbols.

Do not surround words or sentences with special
formatting characters.

The response should look like normal professional
text written directly to the user.
"""


    try:

        response = client.models.generate_content(

            model=GEMINI_MODEL,

            contents=prompt
        )

        answer = response.text

        if not answer:

            answer = (
                "Sorry, I could not generate "
                "a response right now."
            )

        return {

            "type":
                "text",

            "answer":
                answer
        }

    except Exception as error:

        print(
            "GEMINI ERROR:",
            repr(error)
        )

        return {

            "type":
                "text",

            "answer": (
                "Sorry, I am unable to "
                "answer right now."
            )
        }