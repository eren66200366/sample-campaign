import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Klaviyo credentials from environment variables
const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;

// QLS credentials from environment variables
const QLS_USERNAME = process.env.QLS_USERNAME;
const QLS_PASSWORD = process.env.QLS_PASSWORD;
const QLS_AUTH = Buffer.from(`${QLS_USERNAME}:${QLS_PASSWORD}`).toString("base64");

const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

// POST route to handle sample request
app.post('/api/sample', async (req, res) => {
  const { name, email, phone = '', street, housenumber, postalcode, city } = req.body;

  // Step 1: Create a Profile in Klaviyo
  const klaviyoPayload = {
    data: {
      type: "profile",
      attributes: {
        first_name: name,
        email: email,
        phone_number: phone,
        external_id: email // Using email as external_id
      }
    }
  };

  try {
    // 1.1 Send the Profile request to Klaviyo
    console.log('Sending Klaviyo Profile request...');
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
      return res.status(400).json({ 
        error: "Fout bij Klaviyo profiel toevoegen", 
        details: klaviyoData.errors || klaviyoData 
      });
    }

    const profileId = klaviyoData.data.id;
    console.log('Klaviyo Profile Created:', profileId);

    // Step 2: Add the Profile to a Klaviyo List
    const klaviyoListPayload = {
      data: [
        {
          type: "profile",
          id: profileId // Add the profile ID to the list
        }
      ]
    };

    console.log('Sending Klaviyo List Add request...');
    const addToListResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": "2025-07-15"
      },
      body: JSON.stringify(klaviyoListPayload)
    });

    const addToListData = await addToListResponse.json();
    if (!addToListResponse.ok) {
      return res.status(400).json({
        error: "Fout bij het toevoegen aan Klaviyo lijst",
        details: addToListData
      });
    }

    console.log('Profile successfully added to Klaviyo list:', addToListData);

    // Step 3: Create a Fulfillment Order in QLS
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

    console.log('QLS Order Created:', qlsData);

    // Success response
    res.status(200).json({
      message: "✅ Sample succesvol aangevraagd, toegevoegd aan Klaviyo en QLS!",
      klaviyoResponse: addToListData,
      qlsOrderId: qlsData.data.id
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
