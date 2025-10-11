import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// 🔧 Jouw QLS gegevens
const username = "info@hemnature.com";
const password = "45ecf43b01167a15";
const companyId = "8837b58d-3500-43c4-9c47-995fbb3ae402";
const brandId = "26fc7be9-e064-40f9-9463-94a928ddf828";
const productId = "bb746875-4be7-4848-8040-2f268dd3079e";

const auth = Buffer.from(`${username}:${password}`).toString("base64");

// 🔹 API route voor het formulier
app.post("/api/sample", async (req, res) => {
  try {
    const { name, email, street, housenumber, postalcode, city, phone } = req.body;

    // ✅ Bouw de ontvanger info
    const receiver = {
      name,
      companyname: "-",
      street,
      housenumber,
      postalcode,
      locality: city,
      country: "NL",
      email,
      phone: phone || ""
    };

    // ✅ Payload voor QLS
    const payload = {
      reference: `FREE-${Date.now()}`,
      customer_reference: "Gratis Sample Doosje",
      brand_id: brandId,
      status: "created",
      receiver_contact: receiver,
      products: [
        {
          product_id: productId,
          name: "GRATIS Sample Doosje",
          amount_ordered: 1
        }
      ]
    };

    const qlsRes = await fetch(`https://api.pakketdienstqls.nl/companies/${companyId}/fulfillment/orders`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + auth,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await qlsRes.text();

    if (!qlsRes.ok) {
      console.error("QLS error:", text);
      return res.status(400).send(text);
    }

    console.log("✅ QLS order aangemaakt:", text);
    res.status(200).send("Order succesvol aangemaakt");
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).send("Serverfout: " + err.message);
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server draait op poort ${PORT}`));
