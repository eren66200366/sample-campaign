import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Laad de environment variabelen uit .env bestand
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuratie
const corsOptions = {
  origin: '*', // Sta aanvragen van elk domein toe. Vervang dit met een specifieke URL voor beveiliging in productie.
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Gebruik CORS middleware
app.use(cors(corsOptions));
app.use(express.json()); // Om JSON-lichaam te kunnen parsen

// Klaviyo en QLS variabelen uit .env bestand halen
const QLS_USERNAME = process.env.QLS_USERNAME;
const QLS_PASSWORD = process.env.QLS_PASSWORD;
const QLS_AUTH = Buffer.from(`${QLS_USERNAME}:${QLS_PASSWORD}`).toString("base64");

const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;

// POST route voor het ontvangen van de aanvraag
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  // 🔹 Klaviyo profiel aanmaken en toevoegen aan lijst
  const klaviyoPayload = {
    data: {
      type: "profile", // Correcte type
      attributes: {
        first_name: name,
        email: email,
        phone_number: phone,
        external_id: email, // Gebruik email als external_id
      }
    }
  };

  try {
    console.log('Sending Klaviyo Profile request...');
    console.log('Klaviyo Payload:', JSON.stringify(klaviyoPayload, null, 2));

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

    if (!klaviyoResponse.ok) {
      console.error('Klaviyo Response Error:', klaviyoData);
      return res.status(400).json({ 
        error: "Fout bij Klaviyo profiel toevoegen", 
        details: klaviyoData.errors || klaviyoData 
      });
    }

    console.log('Klaviyo Response Status:', klaviyoResponse.status);
    console.log('Klaviyo Response Data:', JSON.stringify(klaviyoData, null, 2));

    // Nu we een succesvol profiel hebben aangemaakt in Klaviyo, voegen we het toe aan de lijst
    const profileId = klaviyoData.data.id; // Haal het profiel ID uit de response

    // 🔹 Voeg het profiel toe aan de lijst
    const klaviyoListPayload = {
      data: [
        {
          type: "list",
          id: KLAVIYO_LIST_ID
        }
      ]
    };

    const addToListResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": "2025-07-15"
      },
      body: JSON.stringify({
        data: [{
          type: "profile",
          id: profileId // Voeg het profiel ID toe aan de lijst
        }]
      })
    });

    const addToListData = await addToListResponse.json();

    if (!addToListResponse.ok) {
      console.error('Klaviyo List Add Error:', addToListData);
      return res.status(400).json({
        error: "Fout bij het toevoegen aan Klaviyo lijst",
        details: addToListData
      });
    }

    console.log('Profile successfully added to Klaviyo list:', addToListData);

    // Nu kunnen we doorgaan met de QLS-order
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

    console.log('Sending QLS Order request...');
    console.log('QLS Payload:', JSON.stringify(qlsPayload, null, 2));

    // 1️⃣ QLS Order
    const qlsResponse = await fetch(`https://api.pakketdienstqls.nl/companies/${COMPANY_ID}/fulfillment/orders`, {
      method: "POST",
      headers: { 
        "Authorization": `Basic ${QLS_AUTH}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(qlsPayload)
    });

    const qlsData = await qlsResponse.json();

    if (!qlsResponse.ok) {
      console.error('QLS Response Error:', qlsData);
      return res.status(400).json({ 
        error: "Fout bij QLS order", 
        details: qlsData.errors || qlsData 
      });
    }

    console.log('QLS Response Status:', qlsResponse.status);
    console.log('QLS Response Data:', JSON.stringify(qlsData, null, 2));

    // ✅ Succes
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd en toegevoegd aan Klaviyo!",
      qlsOrderId: qlsData.data?.id || null,
      klaviyoResponse: addToListData
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

// Start de server
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
