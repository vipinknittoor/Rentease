import { useState } from "react";
import api from "../api/axios";
import "./AIChatbot.css";

interface Message {
  sender: "user" | "ai";
  text?: string;
  places?: Place[];
}

interface Location {
  latitude: number;
  longitude: number;
}

interface Place {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  distance?: number;
  distance_km?: number;
  distance_meters?: number;
  duration_minutes?: number | null;
  rating?: number | null;
  user_rating_count?: number | null;
  primary_type?: string;
  types?: string[];
  google_maps_url?: string;
  directions_url?: string;
  place_id?: string;
}

interface AIResponse {
  type?: string;
  answer: string;
  places?: Place[];
  user_location?: Location;
  place_type?: string;
}

function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "ai",
      text: "Hello! 👋 I'm RentEase AI. How can I help you?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

 

  const PG_LOCATION: Location = {
    latitude: 12.8122268,
    longitude: 74.9308407,
  };

  
  const needsLocation = (message: string): boolean => {
    const lowerMessage = message.toLowerCase().trim();

    const locationPatterns = [
      /\bnearest\b/,
      /\bnearby\b/,
      /\bclosest\b/,
      /\bnear me\b/,
      /\baround me\b/,
      /\bclose to me\b/,
      /\bin my area\b/,
      /\bin my location\b/,
      /\bnear my location\b/,
      /\bhow far\b/,
      /\bdistance to\b/,
      /\bfind .* near\b/,
      /\bfind .* nearby\b/,
      /\bfind .* around\b/,
      /\bshow .* near\b/,
      /\bshow .* nearby\b/,
      /\bsearch .* near\b/,
      /\bsearch .* nearby\b/,
    ];

    return locationPatterns.some((pattern) =>
      pattern.test(lowerMessage)
    );
  };

  

  const createFallbackDirectionsUrl = (place: Place): string => {
    const origin = `${PG_LOCATION.latitude},${PG_LOCATION.longitude}`;

    const destination = `${place.latitude},${place.longitude}`;

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      `&travelmode=driving`;

    console.log("======================================");
    console.log("BUILT FALLBACK DIRECTIONS URL (backend did not send one):");
    console.log("ORIGIN COORDINATES:", origin);
    console.log("DESTINATION:", place.name);
    console.log("DESTINATION LATITUDE:", place.latitude);
    console.log("DESTINATION LONGITUDE:", place.longitude);
    console.log("URL:", url);
    console.log("======================================");

    return url;
  };

  

  const sendMessage = async () => {
    const message = input.trim();

    if (!message || loading) {
      return;
    }

   

    const loggedUser = localStorage.getItem("user");

    if (!loggedUser) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text: message,
        },
        {
          sender: "ai",
          text: "Please login first to use RentEase AI.",
        },
      ]);

      return;
    }

    let currentUser: {
      id?: number;
    };

    try {
      currentUser = JSON.parse(loggedUser);
    } catch (error) {
      console.error("Unable to read logged-in user:", error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text: message,
        },
        {
          sender: "ai",
          text: "Unable to identify the logged-in user.",
        },
      ]);

      return;
    }

    

    if (!currentUser.id) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text: message,
        },
        {
          sender: "ai",
          text: "User ID is missing. Please login again.",
        },
      ]);

      return;
    }

   

    setMessages((prev) => [
      ...prev,
      {
        sender: "user",
        text: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      

      const requestData: {
        message: string;
        user_id: number;
        latitude?: number;
        longitude?: number;
      } = {
        message: message,
        user_id: currentUser.id,
      };

      

      if (needsLocation(message)) {
        

        requestData.latitude = PG_LOCATION.latitude;
        requestData.longitude = PG_LOCATION.longitude;

        console.log("======================================");
        console.log("PG LOCATION SENT (backend uses its own fixed value):");
        console.log("LATITUDE:", PG_LOCATION.latitude);
        console.log("LONGITUDE:", PG_LOCATION.longitude);
        console.log("======================================");
      }

      

      const response = await api.post<AIResponse>(
        "/ai/chat",
        requestData
      );

      const data = response.data;

      

      if (data.places && data.places.length > 0) {
       

        const placesWithDirections = data.places.map((place) => ({
          ...place,

          directions_url:
            place.directions_url ??
            createFallbackDirectionsUrl(place),
        }));

        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            places: placesWithDirections,
          },
        ]);

        setLoading(false);

        return;
      }


      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.answer || "I couldn't find an answer.",
        },
      ]);
    } catch (error) {
      console.error("AI Chat Error:", error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text:
            "Sorry, I couldn't connect to the AI right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  

  const openDirections = (place: Place) => {
    try {
     
      const directionsUrl =
        place.directions_url ??
        createFallbackDirectionsUrl(place);

      console.log("Opening Google Maps from PG...");

      window.open(
        directionsUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "Unable to open directions:",
        error
      );

      alert(
        "Unable to open Google Maps. Please try again."
      );
    }
  };

 

  const openPlace = (place: Place) => {
    if (!place.google_maps_url) {
      return;
    }

    window.open(
      place.google_maps_url,
      "_blank",
      "noopener,noreferrer"
    );
  };


  const formatDistance = (place: Place): string => {
    const distance =
      place.distance_km ??
      place.distance;

    if (
      distance === undefined ||
      distance === null
    ) {
      return "";
    }

    if (distance < 1) {
      const meters = Math.round(distance * 1000);

      return `${meters} m`;
    }

    return `${distance.toFixed(2)} km`;
  };

  

  return (
    <>
      

      <button
        className="ai-floating-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open AI chatbot"
      >
        🤖
      </button>

      

      {isOpen && (
        <div className="ai-chat-window">

          

          <div className="ai-chat-header">
            <div>
              <h3>RentEase AI</h3>

              <span>● Online</span>
            </div>

            <button
              className="ai-close-button"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          

          <div className="ai-chat-messages">

            {messages.map(
              (message, index) => (

                <div
                  key={index}
                  className={`ai-message ${
                    message.sender === "user"
                      ? "user-message"
                      : "bot-message"
                  }`}
                >

                  

                  {message.text && (
                    <div>
                      {message.text}
                    </div>
                  )}

                  

                  {message.places &&
                    message.places.length > 0 && (

                    <div className="ai-places-list">

                      <div className="ai-location-title">
                        📍 Nearest places
                      </div>

                      {message.places.map(
                        (place, placeIndex) => (

                          <div
                            className="ai-place-card"
                            key={
                              place.place_id ||
                              `${place.name}-${placeIndex}`
                            }
                          >

                            

                            <div className="ai-place-header">

                              <span className="ai-place-number">
                                {placeIndex + 1}
                              </span>

                              <strong>
                                {place.name}
                              </strong>

                            </div>

                            

                            <div className="ai-place-distance">

                              📍{" "}

                              <strong>
                                {formatDistance(place)}
                              </strong>{" "}

                              away

                              {place.duration_minutes !==
                                null &&
                                place.duration_minutes !==
                                  undefined && (
                                  <>
                                    {" "}
                                    • 🚗 approximately{" "}

                                    <strong>
                                      {
                                        place.duration_minutes
                                      }{" "}
                                      min
                                    </strong>
                                  </>
                                )}

                            </div>

                            

                            {place.rating !==
                              null &&
                              place.rating !==
                                undefined && (

                              <div className="ai-place-rating">

                                ⭐{" "}

                                <strong>
                                  {place.rating}
                                </strong>

                                {place.user_rating_count ? (
                                  <span>
                                    {" "}
                                    (
                                    {
                                      place.user_rating_count
                                    }{" "}
                                    reviews)
                                  </span>
                                ) : null}

                              </div>
                            )}

                            {}

                            {place.address && (
                              <div className="ai-place-address">
                                📌{" "}
                                {place.address}
                              </div>
                            )}

                            

                            <div className="ai-place-buttons">

                              

                              <button
                                className="ai-directions-button"
                                onClick={() =>
                                  openDirections(place)
                                }
                              >
                                🧭 Get Directions
                              </button>

                              

                              {place.google_maps_url && (
                                <button
                                  className="ai-maps-button"
                                  onClick={() =>
                                    openPlace(place)
                                  }
                                >
                                  🗺️ View Place
                                </button>
                              )}

                            </div>

                          </div>
                        )
                      )}

                      

                      <div className="ai-distance-note">
                        Distances are calculated from your PG using road routing.
                      </div>

                    </div>
                  )}

                </div>
              )
            )}

            

            {loading && (
              <div className="ai-message bot-message">
                Thinking... 🤔
              </div>
            )}

          </div>

          

          <div className="ai-chat-input">

            <input
              type="text"
              placeholder="Ask RentEase AI..."
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={loading}
            />

            <button
              onClick={sendMessage}
              disabled={
                loading ||
                !input.trim()
              }
            >
              ➤
            </button>

          </div>

        </div>
      )}
    </>
  );
}

export default AIChatbot;