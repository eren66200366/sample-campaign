import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json()); // Om JSON-lichaam te kunnen parsen

// QLS inloggegevens
const username = "info@hemnature.com";
const password = "45ecf43b01167a15";
const auth = Buffer.from(`${username}:${password}`).toString("base64");

// Jouw company ID en andere waarden
const companyId = "8837b58d-3500-43c4-9c47-995fbb3ae402";
const brandId = "26fc7be9-e064-40f9-9463-94a928ddf828";
const productId = "bb746875-4be7-4848-8040-2f268dd3079e";

// POST route voor het aanmaken van een fulfillment order
app.post('/api/sample', async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone = '' } = req.body;

  const receiver = {
    name: name,
    companyname: "-",
    street: street,
    housenumber: housenumber,
    postalcode: postalcode,
    locality: city,
    country: "NL",
    email: email,
    phone: phone
  };

  const payload = {
    reference: `FREE-${Date.now()}`,
    customer_reference: "Gratis Sample Doosje",
    brand_id: brandId,
    status: "created",
    receiver_contact: receiver,
    products: [{ 
      product_id: productId, 
      name: "GRATIS Sample Doosje", 
      amount_ordered: 1 
    }]
  };

  try {
    // POST aanvraag naar de fulfillment API van QLS
    const response = await fetch(`https://api.pakketdienstqls.nl/companies/${companyId}/fulfillment/orders`, {
      method: "POST",
      headers: { 
        "Authorization": `Basic ${auth}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok) {
      res.status(200).json({ message: "✅ Sample succesvol aangevraagd!", orderId: data.data.id });
    } else {
      res.status(400).json({ error: "❌ Fout bij het aanmaken van de order", details: data.errors });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "❌ Serverfout bij het verwerken van de aanvraag" });
  }
});

// Start de server
app.listen(port, () => {
  console.log(`Server draait op http://localhost:${port}`);
});
