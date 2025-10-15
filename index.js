import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Environment variables voor Klaviyo en QLS
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;
const QLS_AUTH = process.env.QLS_AUTH;
const COMPANY_ID = process.env.COMPANY_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

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

    // 2️⃣ Maak het profiel aan in Klaviyo
    const klaviyoProfilePayload = {
      data: [
        {
          type: "profile",
          attributes: {
            email: email,
            first_name: name
          }
        }
      ]
    };

    const klaviyoProfileResponse = await fetch('https://a.klaviyo.com/api/profiles/', {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "revision": "2025-07-15"
      },
      body: JSON.stringify(klaviyoProfilePayload)
    });

    const klaviyoProfileData = await klaviyoProfileResponse.json();

    if (!klaviyoProfileResponse.ok) {
      return res.status(400).json({
        error: "Fout bij het aanmaken van het profiel",
        details: klaviyoProfileData
      });
    }

    // 3️⃣ Voeg het profiel toe aan de lijst
    const klaviyoListPayload = {
      data: [
        {
          type: "profile",
          id: klaviyoProfileData.data[0].id // Gebruik de ID van het profiel
        }
      ]
    };

    const klaviyoListResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "revision": "2025-07-15"
      },
      body: JSON.stringify(klaviyoListPayload)
    });

    const klaviyoListData = await klaviyoListResponse.json();

    if (!klaviyoListResponse.ok) {
      return res.status(400).json({
        error: "Fout bij het toevoegen van het profiel aan de lijst",
        details: klaviyoListData
      });
    }

    // ✅ Succes
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd en toegevoegd aan Klaviyo!",
      qlsOrderId: qlsData.data?.id || null,
      klaviyoListResponse: klaviyoListData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
