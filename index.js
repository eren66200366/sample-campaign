import express from "express";
import fetch from "node-fetch";
import cors from "cors"; // CORS-middleware importeren

const app = express();
app.use(express.json());

// CORS inschakelen voor alle domeinen (of je kunt een specifiek domein toevoegen, zie hieronder)
app.use(cors({ origin: "*" })); // Laat alle domeinen toe, pas aan als je alleen Shopify wilt toestaan

const port = process.env.PORT || 3000; // Zet de poort in je server

// Auth en configuraties
const auth = Buffer.from("info@hemnature.com:45ecf43b01167a15").toString("base64");
const companyId = "8837b58d-3500-43c4-9c47-995fbb3ae402";
const brandId = "26fc7be9-e064-40f9-9463-94a928ddf828";
const productId = "bb746875-4be7-4848-8040-2f268dd3079e";

// Maak een POST-endpoint voor je formulierverzoeken
app.post("/api/sample", async (req, res) => {
  const { name, email, street, housenumber, postalcode, city, phone } = req.body;

  // Ontvanger gegevens
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

  const payload = {
    reference: `FREE-${Date.now()}`,
    customer_reference: "Gratis Sample Doosje",
    brand_id: brandId,
    status: "created",
    receiver_contact: receiver,
    products: [{ product_id: productId, name: "GRATIS Sample Doosje", amount_ordered: 1 }]
  };

  // Maak de API-aanroep naar QLS om een sample te verzenden
  try {
    const response = await fetch(`https://api.pakketdienstqls.nl/companies/${companyId}/fulfillment/orders`, {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok) {
      res.json({ message: "✅ Sample succesvol aangevraagd!", data: result });
    } else {
      res.status(400).json({ message: "❌ Er is iets mis gegaan.", error: result });
    }
  } catch (err) {
    console.error("❌ Fout bij verzenden:", err);
    res.status(500).json({ message: "❌ Serverfout. Probeer het later opnieuw." });
  }
});

// Start de server
app.listen(port, () => {
  console.log(`🚀 Server draait op http://localhost:${port}`);
});
