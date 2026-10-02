from database.db import Base, engine

# Import all models here
from models.user import User
from models.tenant import Tenant
from models.password_reset_token import PasswordResetToken

print("Creating tables...")

Base.metadata.create_all(bind=engine)

print("Tables created successfully!")