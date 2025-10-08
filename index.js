import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// 🔐 Jouw QLS inloggegevens
const username = "info@hemnature.com";
const password = "45ecf43b01167a15";
const companyId = "8837b58d-3500-43c4-9c47-995fbb3ae402";
const auth = Buffer.from(`${username}:${password}`).toString("base64");

// 🔹 QLS-brand & product ID (van jouw “GRATIS Sample Doosje”)
const brandId = "26fc7be9-e064-40f9-9463-94a928ddf828";
const productId = "bb746875-4be7-4848-8040-2f268dd3079e";

app.post("/sample-proxy", async (req, res) => {
  try {
    const { name, email, street, housenumber, postalcode, city } = req.body;

    console.log("Nieuwe sample aanvraag ontvangen:", req.body);

    const payload = {
      customer_reference: "Gratis Sample Doosje Campagne",
      brand_id: brandId,
      receiver_contact: {
        name,
        email,
        street,
        housenumber,
        postalcode,
        locality: city,
        country: "NL"
      },
      products: [
        {
          product_id: productId,
          name: "GRATIS Sample Doosje",
          amount_ordered: 1
        }
      ]
    };

    const response = await fetch(
      `https://api.pakketdienstqls.nl/companies/${companyId}/fulfillment-orders`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();
    console.log("QLS Response:", response.status, text);
    res.status(response.status).send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("🚀 Server draait op http://localhost:3000"));
