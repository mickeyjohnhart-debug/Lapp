// api/tide.js (CommonJS for Vercel)
const fetch = require("node-fetch");

const LAT = 49.455;
const LON = -2.536;
const TARGET_HEIGHT = 5.9;

module.exports = async (req, res) => {
    try {
        const API_KEY = process.env.WORLDTIDES_KEY;

        if (!API_KEY) {
            return res.status(500).json({ error: "WorldTides API key is missing" });
        }

        const nowUnix = Math.floor(Date.now() / 1000);
        const endUnix = nowUnix + 86400; // next 24 hours

        const response = await fetch(
            `https://www.worldtides.info/api/v3?heights&lat=${LAT}&lon=${LON}&start=${nowUnix}&end=${endUnix}&key=${API_KEY}`
        );

        if (!response.ok) {
            return res.status(500).json({ error: "Failed to fetch WorldTides data" });
        }

        const data = await response.json();
        const heights = data.heights;
        const now = Date.now() / 1000;

        // Find closest two points for interpolation
        let prevPoint, nextPoint;
        for (let i = 1; i < heights.length; i++) {
            if (heights[i].dt > now) {
                prevPoint = heights[i - 1];
                nextPoint = heights[i];
                break;
            }
        }

        if (!prevPoint || !nextPoint) {
            return res.status(500).json({ error: "No tide data available" });
        }

        const currentHeight = interpolateHeight(prevPoint, nextPoint, now);
        const trend = nextPoint.height > prevPoint.height ? "rising" : "falling";

        // Find next crossing
        let crossingTime = null;
        for (let i = 1; i < heights.length; i++) {
            const prev = heights[i - 1];
            const curr = heights[i];
            if (curr.dt <= now) continue;

            if (trend === "rising" && prev.height < TARGET_HEIGHT && curr.height >= TARGET_HEIGHT) {
                crossingTime = interpolateCrossing(prev, curr);
                break;
            }
            if (trend === "falling" && prev.height > TARGET_HEIGHT && curr.height <= TARGET_HEIGHT) {
                crossingTime = interpolateCrossing(prev, curr);
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

// Helper functions
function interpolateHeight(prev, next, time) {
    const ratio = (time - prev.dt) / (next.dt - prev.dt);
    return prev.height + ratio * (next.height - prev.height);
}

function interpolateCrossing(prev, curr) {
    const ratio = (TARGET_HEIGHT - prev.height) / (curr.height - prev.height);
    return (prev.dt + ratio * (curr.dt - prev.dt)) * 1000; // milliseconds
}
