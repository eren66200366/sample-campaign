import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// QLS gegevens uit .env
const QLS_USERNAME = process.env.QLS_USERNAME;
const QLS_PASSWORD = process.env.QLS_PASSWORD;
const QLS_AUTH = Buffer.from(`${QLS_USERNAME}:${QLS_PASSWORD}`).toString("base64");

const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

// Klaviyo gegevens uit .env
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;

// POST route voor het aanmaken van een fulfillment order en Klaviyo profiel
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  // 🔹 QLS Payload
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

  try {
    // 1️⃣ QLS Order
    console.log("Sending QLS Order request...");
    console.log("QLS Payload:", JSON.stringify(qlsPayload, null, 2));

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

    // 🔹 Klaviyo Payload
    const klaviyoPayload = {
      "data": {
        "type": "profile",
        "id": email, // Gebruik email als profiel ID
        "attributes": {
          "first_name": name,
          "email": email,
          "phone_number": phone,
          "street_address": street,
          "city": city,
          "postal_code": postalcode
        }
      }
    };

    console.log("Sending Klaviyo Profile request...");
    console.log("Klaviyo Payload:", JSON.stringify(klaviyoPayload, null, 2));

    const klaviyoResponse = await fetch(`https://a.klaviyo.com/api/profiles/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": "2025-07-15"
      },
      body: JSON.stringify(klaviyoPayload)
    });

    const klaviyoData = await klaviyoResponse.json();
    console.log("Klaviyo Response Status:", klaviyoResponse.status);
    console.log("Klaviyo Response Data:", JSON.stringify(klaviyoData, null, 2));

    if (!klaviyoResponse.ok) {
      return res.status(400).json({ 
        error: "Fout bij Klaviyo toevoegen", 
        details: klaviyoData.errors || klaviyoData 
      });
    }

    // ✅ Succes
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd en toegevoegd aan Klaviyo!",
      qlsOrderId: qlsData.data?.id || null,
      klaviyoResponse: klaviyoData
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

// Start de server
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
