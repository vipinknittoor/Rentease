import random
import uuid
from datetime import datetime, timedelta


CAPTCHA_EXPIRY_MINUTES = 5

captcha_store: dict[str, dict] = {}


def generate_captcha() -> dict:

    num1 = random.randint(1, 20)
    num2 = random.randint(1, 20)
    operator = random.choice(["+", "-"])

    # Avoid negative results for subtraction
    if operator == "-" and num2 > num1:
        num1, num2 = num2, num1

    if operator == "+":
        answer = num1 + num2
    else:
        answer = num1 - num2

    captcha_id = str(uuid.uuid4())
    question = f"What is {num1} {operator} {num2}?"

    captcha_store[captcha_id] = {
        "answer": answer,
        "expires_at": datetime.utcnow() + timedelta(
            minutes=CAPTCHA_EXPIRY_MINUTES
        ),
        "used": False,
    }

    return {
        "captcha_id": captcha_id,
        "question": question,
    }


def verify_captcha(captcha_id: str, captcha_answer: str) -> bool:

    record = captcha_store.get(captcha_id)

    if record is None:
        return False

    # Already used
    if record["used"]:
        del captcha_store[captcha_id]
        return False

    # Expired
    if datetime.utcnow() > record["expires_at"]:
        del captcha_store[captcha_id]
        return False

    record["used"] = True

    try:
        provided_answer = int(str(captcha_answer).strip())
    except (ValueError, TypeError):
        del captcha_store[captcha_id]
        return False

    is_correct = provided_answer == record["answer"]

    del captcha_store[captcha_id]

    return is_correct