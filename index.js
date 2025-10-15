import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config(); // Zorgt ervoor dat de environment variables beschikbaar zijn

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// QLS Configuratie
const QLS_USERNAME = process.env.QLS_USERNAME;
const QLS_PASSWORD = process.env.QLS_PASSWORD;
const QLS_AUTH = Buffer.from(`${QLS_USERNAME}:${QLS_PASSWORD}`).toString("base64");

const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

// Klaviyo Configuratie
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;

// POST route voor het verwerken van een aanvraag
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  // QLS Payload voor orderaanmaak
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
    // 1️⃣ Verzend QLS order
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
    console.log("QLS Response Data:", qlsData);

    if (!qlsResponse.ok) {
      return res.status(400).json({ 
        error: "Fout bij QLS order", 
        details: qlsData.errors || qlsData 
      });
    }

    // 2️⃣ Maak Klaviyo profiel aan
    console.log("Sending Klaviyo Profile request...");
    const klaviyoPayload = {
      data: {
        type: "profile",
        attributes: {
          email: email,
          first_name: name,
          phone_number: phone,
          street_address: street,
          city: city,
          postal_code: postalcode,
          country: "NL"
        }
      }
    };

    const klaviyoResponse = await fetch(`https://a.klaviyo.com/api/profiles/`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(klaviyoPayload)
    });

    const klaviyoData = await klaviyoResponse.json();
    console.log("Klaviyo Response Status:", klaviyoResponse.status);
    console.log("Klaviyo Response Data:", klaviyoData);

    if (!klaviyoResponse.ok) {
      return res.status(400).json({
        error: "Fout bij Klaviyo profiel aanmaken",
        details: klaviyoData.errors || klaviyoData
      });
    }

    // 3️⃣ Voeg het profiel toe aan de Klaviyo lijst
    const klaviyoListPayload = {
      data: [
        {
          type: "profile",
          id: klaviyoData.data.id
        }
      ]
    };

    const addToListResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(klaviyoListPayload)
    });

    const addToListData = await addToListResponse.json();
    console.log("Add to Klaviyo List Response:", addToListResponse.status);
    console.log("Add to Klaviyo List Data:", addToListData);

    if (!addToListResponse.ok) {
      return res.status(400).json({
        error: "Fout bij het toevoegen van het profiel aan Klaviyo lijst",
        details: addToListData.errors || addToListData
      });
    }

    // ✅ Succesvolle aanvraag
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd en toegevoegd aan Klaviyo!",
      qlsOrderId: qlsData.data?.id || null,
      klaviyoResponse: addToListData
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
