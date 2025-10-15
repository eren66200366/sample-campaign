import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Laad de .env-bestand
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 🔹 QLS gegevens
const QLS_USERNAME = process.env.QLS_USERNAME;
const QLS_PASSWORD = process.env.QLS_PASSWORD;
const QLS_AUTH = Buffer.from(`${QLS_USERNAME}:${QLS_PASSWORD}`).toString("base64");

const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

// 🔹 Klaviyo gegevens
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;
const KLAVIYO_REVISION = "2025-07-15";  // De versie die je nodig hebt

// POST route
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  console.log("Received Data:", req.body);  // Log de ontvangen data voor debugging

  // 1️⃣ QLS Order Payload
  const receiver = {
    name,
    companyname: "-",
    street,
    housenumber,
    postalcode,
    locality: city,
    country: "NL",
    email,
    phone
  };

  const qlsPayload = {
    reference: `FREE-${Date.now()}`,
    customer_reference: "Gratis Sample Doosje",
    brand_id: BRAND_ID,
    status: "created",
    receiver_contact: receiver,
    products: [{ 
      product_id: PRODUCT_ID, 
      name: "GRATIS Sample Doosje", 
      amount_ordered: 1 
    }]
  };

  console.log("QLS Payload:", JSON.stringify(qlsPayload, null, 2)); // Debuggen van QLS payload

  try {
    // 1️⃣ QLS Order request
    console.log("Sending QLS Order request...");
    const qlsResponse = await fetch(`https://api.pakketdienstqls.nl/companies/${COMPANY_ID}/fulfillment/orders`, {
      method: "POST",
      headers: { 
        "Authorization": `Basic ${QLS_AUTH}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(qlsPayload)
    });

    const qlsData = await qlsResponse.json();
    console.log("QLS Response Status:", qlsResponse.status);
    console.log("QLS Response Data:", JSON.stringify(qlsData, null, 2));

    if (!qlsResponse.ok) {
      return res.status(400).json({ 
        error: "Fout bij QLS order", 
        details: qlsData.errors || qlsData 
      });
    }

    // 2️⃣ Klaviyo Profile Payload
    const profilePayload = {
      data: [
        {
          type: "profile",
          id: email,  // Gebruik email als unieke ID
          attributes: {
            first_name: name,
            email: email,
            phone_number: phone,
            street_address: street,
            city: city,
            postal_code: postalcode
          }
        }
      ]
    };

    console.log("Klaviyo Profile Payload:", JSON.stringify(profilePayload, null, 2));

    // 2️⃣ Klaviyo Profile request
    console.log("Sending Klaviyo Profile request...");
    const klaviyoResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: 'POST',
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": KLAVIYO_REVISION
      },
      body: JSON.stringify(profilePayload)
    });

    const klaviyoData = await klaviyoResponse.json();
    console.log("Klaviyo Response Status:", klaviyoResponse.status);
    console.log("Klaviyo Response Data:", JSON.stringify(klaviyoData, null, 2));

    if (!klaviyoResponse.ok) {
      return res.status(400).json({
        error: "Fout bij het toevoegen van het profiel aan Klaviyo",
        details: klaviyoData.errors || klaviyoData
      });
    }

    // 3️⃣ Voeg profiel toe aan Klaviyo lijst
    const listPayload = {
      data: [
        {
          type: "profile",
          id: email  // Voeg het profiel toe met de email als profiel-ID
        }
      ]
    };

    console.log("Sending Klaviyo List request...");
    const listResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: 'POST',
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": KLAVIYO_REVISION
      },
      body: JSON.stringify(listPayload)
    });

    const listData = await listResponse.json();
    console.log("Klaviyo List Response Status:", listResponse.status);
    console.log("Klaviyo List Response Data:", JSON.stringify(listData, null, 2));

    if (!listResponse.ok) {
      return res.status(400).json({
        error: "Fout bij het toevoegen van het profiel aan de Klaviyo lijst",
        details: listData.errors || listData
      });
    }

    // ✅ Succes
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd en profiel toegevoegd aan Klaviyo lijst!",
      qlsOrderId: qlsData.data?.id || null,
      klaviyoResponse: listData
    });

  } catch (error) {
    console.error("Fout:", error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
