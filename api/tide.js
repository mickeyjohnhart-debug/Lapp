// api/tide.js - StormGlass version

const LAT = 49.455;
const LNG = -2.536;
const TARGET_HEIGHT = 5.9;

module.exports = async (req, res) => {
  try {
    const API_KEY = process.env.STORMGLASS_KEY;

    if (!API_KEY) {
      return res.status(500).json({ error: "StormGlass API key missing" });
    }

    const now = new Date();
    const start = now.toISOString();
    const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const end = endDate.toISOString();

    const response = await fetch(
      `https://api.stormglass.io/v2/tide/sea-level/point?lat=${LAT}&lng=${LNG}&start=${start}&end=${end}`,
      {
        headers: {
          Authorization: API_KEY
        }
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: "StormGlass request failed" });
    }

    const data = await response.json();
    const heights = data.data;

    if (!heights || heights.length < 2) {
      return res.status(500).json({ error: "No tide data returned" });
    }

    const nowUnix = Date.now();

    // Find current position between two points
    let prev, next;
    for (let i = 1; i < heights.length; i++) {
      const pointTime = new Date(heights[i].time).getTime();
      if (pointTime > nowUnix) {
        prev = heights[i - 1];
        next = heights[i];
        break;
      }
    }

    if (!prev || !next) {
      return res.status(500).json({ error: "Could not determine tide state" });
    }

    const prevTime = new Date(prev.time).getTime();
    const nextTime = new Date(next.time).getTime();

    const ratio = (nowUnix - prevTime) / (nextTime - prevTime);
    const currentHeight =
      prev.sg + ratio * (next.sg - prev.sg);

    const trend = next.sg > prev.sg ? "rising" : "falling";

    // Find next crossing
    let crossingTime = null;

    for (let i = 1; i < heights.length; i++) {
      const h1 = heights[i - 1];
      const h2 = heights[i];

      const t1 = new Date(h1.time).getTime();
      const t2 = new Date(h2.time).getTime();

      if (t2 <= nowUnix) continue;

      if (
        (trend === "rising" && h1.sg < TARGET_HEIGHT && h2.sg >= TARGET_HEIGHT) ||
        (trend === "falling" && h1.sg > TARGET_HEIGHT && h2.sg <= TARGET_HEIGHT)
      ) {
        const r =
          (TARGET_HEIGHT - h1.sg) / (h2.sg - h1.sg);
        crossingTime = t1 + r * (t2 - t1);
        break;
      }
    }

    res.status(200).json({
      currentHeight: currentHeight.toFixed(2),
      trend,
      crossingTime
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
