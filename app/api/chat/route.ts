import { NextResponse } from 'next/server';

export const maxDuration = 60;

type ChatMessage = {
  sender: 'user' | 'ai';
  text?: string;
};

type ChatRequest = {
  messages?: ChatMessage[];
  location?: { latitude: number; longitude: number } | null;
};

type MarinePoint = {
  label: string;
  value: string;
};

type NearbyPlace = {
  name: string;
  type: string;
  distanceKm: number;
};

const SYSTEM_PROMPT = `You are NEER AI, a marine information assistant.
Only answer questions about oceans, seas, rivers, ponds, marine weather, boats, fishing,
water safety, navigation, bathymetry, ports, and marine locations. For unrelated questions,
politely say you only provide water and marine information.
Never invent real-time boat counts, people counts, measured depth, weather, or safety conditions.
For depth questions, first determine whether the available map/source data or reliable general knowledge can answer. If an exact local depth is unavailable, say so plainly. You may give a broad regional estimate only when you have a defensible basis, and label it as an unverified estimate rather than a measurement. Never make up a specific depth to fill the gap.
Clearly label information as live/current only when it is provided by a connected data source.
OpenSeaMap is a map reference, not a guaranteed live AIS or depth source.
Be concise, useful, and answer in the same language and script used by the user.
For a current-location question, clearly state that the location comes from the user's browser permission
and distinguish known coordinates/place information from unavailable live marine data.`;

const isLocationQuestion = (text: string) =>
  /\b(location|current location|my location|where|map|coordinates|position|boat|depth|near me|place|gehrai|gaharai|samundar|sagar|naksha|जगह|स्थान|लोकेशन|कहां|नक्शा|गहराई|नाव)\b/i.test(text);

async function reverseGeocode(location: { latitude: number; longitude: number }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}&zoom=10`,
      {
        headers: { 'User-Agent': 'NeerAI/1.0 marine assistant location lookup' },
        signal: controller.signal,
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { display_name?: string };
    return data.display_name || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function distanceInKm(
  origin: { latitude: number; longitude: number },
  target: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const latitudeDelta = ((target.latitude - origin.latitude) * Math.PI) / 180;
  const longitudeDelta = ((target.longitude - origin.longitude) * Math.PI) / 180;
  const originLatitude = (origin.latitude * Math.PI) / 180;
  const targetLatitude = (target.latitude * Math.PI) / 180;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.sin(longitudeDelta / 2) ** 2 * Math.cos(originLatitude) * Math.cos(targetLatitude);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function findNearbyPlaces(location: { latitude: number; longitude: number }): Promise<NearbyPlace[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const query = `[out:json][timeout:6];(
    nwr(around:5000,${location.latitude},${location.longitude})["natural"~"water|coastline"];
    nwr(around:5000,${location.latitude},${location.longitude})["waterway"];
    nwr(around:5000,${location.latitude},${location.longitude})["amenity"~"ferry_terminal|harbour|marina"];
  );out center tags 20;`;
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'NeerAI/1.0 marine assistant map lookup' },
      body: query,
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      elements?: Array<{
        tags?: { name?: string; natural?: string; waterway?: string; amenity?: string };
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
      }>;
    };
    const places = (data.elements || [])
      .map((element) => {
        const coordinates = element.lat !== undefined && element.lon !== undefined
          ? { latitude: element.lat, longitude: element.lon }
          : element.center
            ? { latitude: element.center.lat, longitude: element.center.lon }
            : null;
        if (!coordinates) return null;
        const tags = element.tags || {};
        const type = tags.waterway || tags.natural || tags.amenity || 'marine feature';
        return {
          name: tags.name || type.replace(/_/g, ' '),
          type,
          distanceKm: distanceInKm(location, coordinates),
        };
      })
      .filter((place): place is NearbyPlace => Boolean(place && place.distanceKm <= 5))
      .sort((first, second) => first.distanceKm - second.distanceKm);
    return places.slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function askGemini(apiKey: string, contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>) {
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-flash-lite-latest';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
        }),
      }
    );
    if (!response.ok) {
      throw new Error(`NEER AI provider request failed with status ${response.status}`);
    }
    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!answer) throw new Error('Gemini returned an empty response');
    return answer;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    let body: ChatRequest;
    try {
      body = (await request.json()) as ChatRequest;
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'Send at least one message.' }, { status: 400 });
    }

    const messages = body.messages.filter(
      (message): message is ChatMessage =>
        Boolean(message) &&
        (message.sender === 'user' || message.sender === 'ai') &&
        typeof message.text === 'string' &&
        message.text.trim().length > 0
    );
    const lastUserMessage = [...messages].reverse().find((message) => message.sender === 'user')?.text?.trim();
    if (!lastUserMessage) {
      return NextResponse.json({ error: 'A question is required' }, { status: 400 });
    }

    const locationQuestion = isLocationQuestion(lastUserMessage);
    const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP]
      .map((key) => key?.trim())
      .filter((key): key is string => Boolean(key));
    if (keys.length === 0) {
      return NextResponse.json({
        error: 'NEER AI is not connected yet. Add GEMINI_API_KEY to the Vercel project’s Environment Variables and redeploy.',
        code: 'MISSING_GEMINI_API_KEY',
      }, { status: 503 });
    }

    const validLocation = body.location &&
      Number.isFinite(body.location.latitude) &&
      Number.isFinite(body.location.longitude) &&
      Math.abs(body.location.latitude) <= 90 &&
      Math.abs(body.location.longitude) <= 180
      ? body.location
      : null;
    const [locationLabel, nearbyPlaces] = locationQuestion && validLocation
      ? await Promise.all([reverseGeocode(validLocation), findNearbyPlaces(validLocation)])
      : [null, [] as NearbyPlace[]];
    const locationContext = validLocation
      ? `\nBrowser location, shared after user permission (approximate): ${validLocation.latitude}, ${validLocation.longitude}${locationLabel ? `\nApproximate place name from reverse geocoding: ${locationLabel}` : ''}`
      : '';
    const contents = messages
      .filter((message) => message.text)
      .slice(-20)
      .map((message) => ({
        role: message.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: message.text || '' }],
      }));
    const latestUserIndex = contents.map((content) => content.role).lastIndexOf('user');
    if (latestUserIndex < 0) {
      return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
    }
    contents[latestUserIndex].parts[0].text += locationContext;

    let answer = '';
    let lastError: unknown;
    for (const key of keys) {
      try {
        answer = await askGemini(key, contents);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!answer) {
      console.error('Gemini providers failed', lastError);
      return NextResponse.json({ error: 'NEER AI could not get a reply from its AI provider. Check the Vercel environment variable values and try again.' }, { status: 502 });
    }
    const brandedAnswer = `NEER AI: ${answer.replace(/^NEER AI:\s*/i, '')}`;
    const marinePoints: MarinePoint[] = locationQuestion && validLocation
      ? (() => {
          const hindi = /[\u0900-\u097F]/.test(lastUserMessage);
          const nearbySummary = nearbyPlaces.length
            ? nearbyPlaces.map((place) => `${place.name} (${place.distanceKm.toFixed(2)} km)`).join(', ')
            : hindi
              ? '5 km के अंदर OpenStreetMap पर कोई नाम वाली marine feature नहीं मिली।'
              : 'No named marine feature was found within 5 km on OpenStreetMap.';
          return hindi
            ? [
                { label: 'स्थान', value: locationLabel || 'ब्राउज़र से मिली अनुमानित लोकेशन' },
                { label: 'निर्देशांक', value: `${validLocation.latitude.toFixed(5)}, ${validLocation.longitude.toFixed(5)}` },
                { label: 'दूरी', value: 'यह map आपकी current location पर centered है; किसी destination का नाम/स्थान न मिलने से destination distance उपलब्ध नहीं है।' },
                { label: 'आसपास की चीज़ें', value: nearbySummary },
                { label: 'मैप डेटा', value: 'OpenSeaMap के marine layers' },
                { label: 'Live data नोट', value: 'Boat count, लोगों की संख्या और exact depth के लिए live AIS/bathymetry source चाहिए।' },
              ]
            : [
                { label: 'Location', value: locationLabel || 'Approximate browser location' },
                { label: 'Coordinates', value: `${validLocation.latitude.toFixed(5)}, ${validLocation.longitude.toFixed(5)}` },
                { label: 'Distance', value: 'This map is centered on your current location; a destination distance is unavailable because no destination was identified.' },
                { label: 'Nearby things', value: nearbySummary },
                { label: 'Map data', value: 'OpenSeaMap marine layers' },
                { label: 'Live data note', value: 'Boat count, people count and exact depth require a live AIS/bathymetry source.' },
              ];
        })()
      : [];
    return new NextResponse(
      JSON.stringify({
        answer: brandedAnswer,
        showMap: locationQuestion && Boolean(validLocation),
        mapLocation: validLocation,
        locationLabel,
        marinePoints,
        nearbyPlaces,
      }),
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error) {
    console.error('Chat API error', error);
    return NextResponse.json({ error: 'Invalid chat request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'NEER AI chat API',
    configured: Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.GEMINI_API_KEY_BACKUP?.trim()),
  });
}
