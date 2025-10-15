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

// QLS and Klaviyo credentials from environment variables
const QLS_USERNAME = process.env.QLS_USERNAME;
const QLS_PASSWORD = process.env.QLS_PASSWORD;
const QLS_AUTH = Buffer.from(`${QLS_USERNAME}:${QLS_PASSWORD}`).toString("base64");

const COMPANY_ID = process.env.COMPANY_ID;
const BRAND_ID = process.env.BRAND_ID;
const PRODUCT_ID = process.env.PRODUCT_ID;

const KLAVIYO_PRIVATE_KEY = process.env.KLAVIYO_PRIVATE_KEY;
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID;

// POST route to handle sample request
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  // 🔹 Klaviyo profile creation
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

    // Log the raw response text
    const klaviyoResponseText = await klaviyoResponse.text();
    console.log("Raw Klaviyo Response Text:", klaviyoResponseText);

    // If the response is not empty, parse it
    let klaviyoData;
    if (klaviyoResponseText) {
      klaviyoData = JSON.parse(klaviyoResponseText);
    } else {
      console.error("Empty response from Klaviyo");
      return res.status(400).json({ error: "Empty response from Klaviyo" });
    }

    if (!klaviyoResponse.ok) {
      console.error('Klaviyo Response Error:', klaviyoData);
      return res.status(400).json({ 
        error: "Fout bij Klaviyo profiel toevoegen", 
        details: klaviyoData.errors || klaviyoData 
      });
    }

    console.log('Klaviyo Response Status:', klaviyoResponse.status);
    console.log('Klaviyo Response Data:', JSON.stringify(klaviyoData, null, 2));

    // Now that we have a successful profile created in Klaviyo, add it to the list
    const profileId = klaviyoData.data.id; // Get the profile ID from the response

    // 🔹 Add profile to Klaviyo list
    const klaviyoListPayload = {
      data: [
        {
          type: "profile",
          id: profileId // Add the profile ID to the list
        }
      ]
    };

    console.log('Sending Klaviyo List Add request...');
    console.log('Klaviyo List Payload:', JSON.stringify(klaviyoListPayload, null, 2));

    const addToListResponse = await fetch(`https://a.klaviyo.com/api/lists/${KLAVIYO_LIST_ID}/relationships/profiles`, {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${KLAVIYO_PRIVATE_KEY}`,
        "Content-Type": "application/json",
        "Revision": "2025-07-15"
      },
      body: JSON.stringify(klaviyoListPayload)
    });

    // Check the raw response and log it
    const addToListResponseText = await addToListResponse.text();
    console.log("Raw Add to List Response Text:", addToListResponseText);

    // If the response is not empty, parse it
    let addToListData;
    if (addToListResponseText) {
      addToListData = JSON.parse(addToListResponseText);
    } else {
      console.error("Empty response when adding profile to list");
      return res.status(400).json({ error: "Empty response when adding profile to list" });
    }

    if (!addToListResponse.ok) {
      console.error('Klaviyo List Add Error:', addToListData);
      return res.status(400).json({
        error: "Fout bij het toevoegen aan Klaviyo lijst",
        details: addToListData
      });
    }

    console.log('Profile successfully added to Klaviyo list:', addToListData);

    // Proceed with QLS order
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
