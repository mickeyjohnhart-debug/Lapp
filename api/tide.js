export default async function handler(req, res) {
  try {
    const lat = 49.455; // Guernsey
    const lng = -2.54;

    const response = await fetch(
      `https://api.stormglass.io/v2/tide/sea-level/point?lat=${lat}&lng=${lng}`,
      {
        headers: {
          Authorization: process.env.STORMGLASS_API_KEY
        }
      }
    );

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return res.status(500).json({ error: "No tide data received" });
    }

    const now = new Date();

    const closest = data.data.reduce((prev, curr) => {
      return Math.abs(new Date(curr.time) - now) <
        Math.abs(new Date(prev.time) - now)
        ? curr
        : prev;
    });

    const currentHeight = closest.sg;
    const trend = "rising"; // simplified for now

    // Find next time tide crosses 5.9m
    const crossing = data.data.find(d => d.sg >= 5.9);

    const crossingTime = crossing ? crossing.time : null;

    res.status(200).json({
      currentHeight,
      trend,
      crossingTime
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}
