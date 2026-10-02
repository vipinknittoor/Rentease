import os
import resend

RESEND_API_KEY = os.getenv("RESEND_API_KEY")

resend.api_key = RESEND_API_KEY

print(
    "RESEND API KEY LOADED:",
    bool(RESEND_API_KEY)
)

def send_password_reset_email(
    recipient_email: str,
    reset_link: str
):

    print("==========================================")
    print("STARTING PASSWORD RESET EMAIL")
    print("Recipient:", recipient_email)
    print("==========================================")

    try:

        print("Calling Resend...")

        response = resend.Emails.send(
            {
                "from": "RentEase <noreply@ihubonline.in>",
                "to": [recipient_email],
                "subject": "RentEase - Reset Your Password",

                "html": f"""
                <html>

                    <body
                        style="
                            font-family: Arial, sans-serif;
                            background-color: #f5f5f5;
                            padding: 30px;
                        "
                    >

                        <div
                            style="
                                max-width: 600px;
                                margin: auto;
                                background: white;
                                padding: 30px;
                                border-radius: 10px;
                            "
                        >

                            <h2>
                                Reset Your RentEase Password
                            </h2>

                            <p>
                                We received a request to reset
                                your RentEase account password.
                            </p>

                            <p>
                                Click the button below to create
                                a new password.
                            </p>

                            <p style="margin: 30px 0;">

                                <a
                                    href="{reset_link}"
                                    style="
                                        background-color: #2563eb;
                                        color: white;
                                        padding: 12px 20px;
                                        text-decoration: none;
                                        border-radius: 6px;
                                        display: inline-block;
                                    "
                                >
                                    Reset Password
                                </a>

                            </p>

                            <p>
                                This link will expire in
                                <strong>30 minutes</strong>.
                            </p>

                            <p>
                                If you did not request a password
                                reset, you can safely ignore this email.
                            </p>

                            <hr>

                            <p
                                style="
                                    color: #777;
                                    font-size: 12px;
                                "
                            >
                                RentEase
                            </p>

                        </div>

                    </body>

                </html>
                """
            }
        )

        print("==========================================")
        print("RESEND RESPONSE:")
        print(response)
        print("==========================================")

        return response

    except Exception as error:

        print("==========================================")
        print("PASSWORD RESET EMAIL ERROR:")
        print(error)
        print("==========================================")

        raise


def send_payment_reminder_email(
    recipient_email: str,
    tenant_name: str,
    billing_month: str,
    monthly_rent: float,
    electricity_bill: float,
    carry_forward_amount: float,
    total_amount: float,
    extra_bill: float = 0
):

    print("==========================================")
    print("STARTING PAYMENT REMINDER EMAIL")
    print("Recipient:", recipient_email)
    print("Tenant:", tenant_name)
    print("Billing Month:", billing_month)
    print("==========================================")

    try:

        response = resend.Emails.send(
            {
                "from": "RentEase <noreply@ihubonline.in>",

                "to": [recipient_email],

                "subject":
                    f"RentEase - Payment Reminder - {billing_month}",

                "html": f"""
                <html>

                    <body
                        style="
                            margin: 0;
                            padding: 30px;
                            background-color: #f5f7fb;
                            font-family: Arial, Helvetica, sans-serif;
                            color: #333333;
                        "
                    >

                        <div
                            style="
                                max-width: 600px;
                                margin: 0 auto;
                                background-color: #ffffff;
                                border-radius: 12px;
                                padding: 32px;
                                box-shadow:
                                    0 2px 10px
                                    rgba(0,0,0,0.08);
                            "
                        >

                            <h2
                                style="
                                    margin-top: 0;
                                    color: #2563eb;
                                "
                            >
                                RentEase
                            </h2>

                            <h3>
                                Payment Reminder
                            </h3>

                            <p>
                                Hello
                                <strong>{tenant_name}</strong>,
                            </p>

                            <p>
                                This is a friendly reminder that
                                your RentEase payment for
                                <strong>{billing_month}</strong>
                                is still pending.
                            </p>

                            <table
                                style="
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin: 25px 0;
                                "
                            >

                                <tr>
                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                        "
                                    >
                                        Billing Month
                                    </td>

                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                            text-align: right;
                                            font-weight: bold;
                                        "
                                    >
                                        {billing_month}
                                    </td>
                                </tr>

                                <tr>
                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                        "
                                    >
                                        Monthly Rent
                                    </td>

                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                            text-align: right;
                                        "
                                    >
                                        ₹{monthly_rent:,.2f}
                                    </td>
                                </tr>

                                <tr>
                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                        "
                                    >
                                        Electricity Bill
                                    </td>

                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                            text-align: right;
                                        "
                                    >
                                        ₹{electricity_bill:,.2f}
                                    </td>
                                </tr>

                                <tr>
                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                        "
                                    >
                                        Extra Bill
                                    </td>

                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                            text-align: right;
                                        "
                                    >
                                        ₹{extra_bill:,.2f}
                                    </td>
                                </tr>

                                <tr>
                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                        "
                                    >
                                        Previous Due
                                    </td>

                                    <td
                                        style="
                                            padding: 10px;
                                            border-bottom:
                                                1px solid #eeeeee;
                                            text-align: right;
                                        "
                                    >
                                        ₹{carry_forward_amount:,.2f}
                                    </td>
                                </tr>

                                <tr>

                                    <td
                                        style="
                                            padding: 15px 10px;
                                            font-size: 18px;
                                            font-weight: bold;
                                        "
                                    >
                                        Total Amount Due
                                    </td>

                                    <td
                                        style="
                                            padding: 15px 10px;
                                            text-align: right;
                                            font-size: 18px;
                                            font-weight: bold;
                                            color: #dc2626;
                                        "
                                    >
                                        ₹{total_amount:,.2f}
                                    </td>

                                </tr>

                            </table>

                            <p>
                                Kindly make your payment at your
                                earliest convenience.
                            </p>

                            <p>
                                If you have already made the payment,
                                please ignore this reminder.
                            </p>

                            <hr
                                style="
                                    border: none;
                                    border-top:
                                        1px solid #eeeeee;
                                    margin: 30px 0;
                                "
                            >

                            <p
                                style="
                                    color: #777777;
                                    font-size: 12px;
                                    margin-bottom: 0;
                                "
                            >
                                This is an automated message
                                from RentEase.
                                <br>
                                Please do not reply to this email.
                            </p>

                        </div>

                    </body>

                </html>
                """
            }
        )

        print("==========================================")
        print("PAYMENT REMINDER EMAIL SENT")
        print("RESEND RESPONSE:")
        print(response)
        print("==========================================")

        return response

    except Exception as error:

        print("==========================================")
        print("PAYMENT REMINDER EMAIL ERROR:")
        print(error)
        print("==========================================")

        raise