// app/api/reverse-geocode/route.ts
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: "lat/lon required" }), { status: 400 });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&accept-language=uk`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "wardrobe-mvp/1.0 (reverse-geocode)",
      },
      // Nominatim дозволяє CORS; на всяк випадок server-side fetch
      cache: "no-store",
    });

    const json = await res.json();
    const a = json?.address || {};
    const city =
      a.city ||
      a.town ||
      a.village ||
      a.municipality ||
      a.state ||
      a.region ||
      null;

    return new Response(JSON.stringify({ city }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ city: null }), { status: 200 });
  }
}
