from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from models.payment import Payment

from database.db import engine, Base


# Import models so SQLAlchemy registers tables
from models import tenant
from models import user
from models import room
from models import room_request
from models import refresh_token

# Import routers
from routers.tenant_router import router as tenant_router
from routers.user_router import router as user_router
from routers.room_router import router as room_router
from routers.dashboard_router import router as dashboard_router
from routers.payment_router import router as payment_router
from routers.room_request_router import router as room_request_router
from routers import ai

# Rate limiter
from services.rate_limit import limiter



Base.metadata.create_all(bind=engine)




app = FastAPI(
    title="RentEase API",
    version="0.1.0"
)



app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)



from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # exact origin, NOT "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# TENANT APIs


app.include_router(tenant_router)


# USER APIs


app.include_router(user_router)



# ROOM APIs


app.include_router(room_router)


# DASHBOARD APIs


app.include_router(dashboard_router)


# PAYMENT APIs


app.include_router(payment_router)
app.include_router(room_request_router)



# AI APIs


app.include_router(ai.router)



# HOME


@app.get("/")
def home():
    return {
        "message": "RentEase Backend Running 🚀"
    }