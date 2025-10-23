import type { FC } from "hono/jsx";

interface MutualReferrerEmailProps {
    name: string;
    promoCode: string;
}

const MutualReferrerEmailTemplate: FC<MutualReferrerEmailProps> = (props) => {
    return (
        <html>
            <head>
                <meta charset="UTF-8" />
                <title>⚡️ Lightning Lessons Promo Code</title>
            </head>
            <body>
                <div>
                    <p>Hello {props.name}</p>
                    <p>
                        Your 15% off promo code is <b>{props.promoCode}</b>
                    </p>
                    <p>
                        This code is only valid for 1 use, so don't share it
                        with anyone else 😊.
                    </p>
                    <p>See you in class!</p>
                </div>
            </body>
        </html>
    );
};

export default MutualReferrerEmailTemplate;
