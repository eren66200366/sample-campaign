import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();  // Laad omgevingsvariabelen uit .env bestand

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// QLS gegevens
const QLS_AUTH = Buffer.from(`${process.env.QLS_USERNAME}:${process.env.QLS_PASSWORD}`).toString("base64");
const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

// Klaviyo gegevens
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;
const KLAVIYO_REVISION = '2025-07-15'; // Voeg de versie van de API toe als je deze niet dynamisch wil ophalen

// POST route
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  // QLS payload
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
      return res.status(400).json({ 
        error: "Fout bij QLS order", 
        details: qlsData.errors || qlsData 
      });
    }

    // 2️⃣ Klaviyo payload
    const klaviyoPayload = {
      data: [
        {
          type: "profile",
          id: email,
          attributes: {
            first_name: name
          }
        }
      ]
    };

    const klaviyoResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": KLAVIYO_REVISION
      },
      body: JSON.stringify(klaviyoPayload)
    });

    const klaviyoData = await klaviyoResponse.json();

    if (!klaviyoResponse.ok) {
      return res.status(400).json({ 
        error: "Fout bij Klaviyo toevoegen", 
        details: klaviyoData 
      });
    }

    // ✅ Succes
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd en toegevoegd aan Klaviyo!",
      qlsOrderId: qlsData.data?.id || null,
      klaviyoResponse: klaviyoData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
