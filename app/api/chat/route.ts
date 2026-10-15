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
Answer only questions about oceans, seas, rivers, lakes, ponds, aquatic life, marine ecosystems,
fishing, boats, water geography, ports, navigation, bathymetry, and water safety. Politely redirect
questions that are entirely unrelated to water or marine topics.
For every in-scope question, give the most useful answer you can. If exact, local, or real-time data
is unavailable, explain that briefly and provide relevant established background, typical regional
patterns, or a cautious estimate only when you have a defensible basis. Clearly label estimates and
historical/general information; never present them as a verified current measurement.
Never fabricate exact coordinates, nearby places, distances, fishing advisories, measured depths,
weather, boat counts, or safety conditions. If an exact number is unknown, give qualitative context
and say what source or additional detail would establish it instead of making up a number.
For a question about the depth of a specific harbor, river, lake, coast, or other waterbody, never
provide a numeric depth or numeric range unless a verified hydrographic measurement is included in
the supplied context. This API has no such measurement source; explain that depths vary by location
and offer relevant qualitative context without guessing a number.
There is no connected bathymetry, AIS, live weather, or official Potential Fishing Zone feed. Do not
claim current conditions. A map center is only a geocoded place reference, not evidence of water
depth or a fishing zone. OpenStreetMap/OpenSeaMap are map references, not guaranteed live AIS or depth sources.
Be concise, useful, and answer in the same language and script used by the user.
Use conversation history to resolve short follow-ups such as “location” or “how deep” from the most
recent relevant place and topic. Do not substitute browser coordinates unless the user explicitly
asks for their own current location.
For a current-location question, clearly state that the location comes from the user's browser permission
and distinguish known coordinates/place information from unavailable live marine data.`;

const isMapRequest = (text: string) =>
  /\b(location|map|where|near|nearby|spot|zone|harbou?r|coordinates|place)\b/i.test(text) ||
  /\bfish(?:ing)?\b.{0,60}\b(?:in|at|near|around|zone|spot)\b|\b(?:in|at|near|around)\b.{0,60}\bfish(?:ing)?\b/i.test(text) ||
  /लोकेशन|जगह|स्थान|नक्शा|कहाँ|कहां|मछली.{0,40}(?:पास|में|तट|क्षेत्र)|(?:पास|में|तट).{0,40}मछली/.test(text);

const isDepthQuestion = (text: string) =>
  /\b(depth|how deep|bathymetry|bathymetric|sea floor|seafloor|gehrai|gaharai)\b|गहराई|कितना गहरा/i.test(text);

const isFishingZoneQuestion = (text: string) =>
  /\b(?:pfz|potential fishing zone|fishing\s+(?:zone|spot|area)|fishing\s+near|nearby\s+fishing)\b/i.test(text) ||
  /मछली पकड़ने का क्षेत्र|मछली पकड़ने की जगह|पीएफजेड/.test(text);

const asksForCurrentLocation = (text: string) =>
  /\b(?:my|current)\s+(?:current\s+)?(?:location|position|coordinates)\b|\bwhere am i\b|\bnear me\b|\baround me\b|\b(?:mera|meri|apni)\s+(?:current\s+)?(?:location|jagah|position|coordinates)\b|मेरी\s+(?:वर्तमान\s+)?(?:लोकेशन|जगह|स्थिति)|मेरा\s+(?:वर्तमान\s+)?(?:लोकेशन|जगह|स्थिति)|मैं\s+(?:अभी\s+)?कहाँ\s+हूँ|मेरे\s+आसपास/i.test(text);

const isMarineTopic = (text: string) =>
  /\b(ocean|sea|marine|river|pond|lake|water|boat|ship|fishing|fish|coast|coastal|harbou?r|port|tide|wave|depth|bathymetry|sail|navigation|pfz)\b/i.test(text) ||
  /समुद्र|सागर|नदी|तालाब|झील|पानी|नाव|जहाज|मछली|तट|ज्वार|लहर|गहराई/.test(text);

const PLACE_STOP_WORDS = new Set([
  'a', 'about', 'at', 'around', 'can', 'current', 'depth', 'do', 'find', 'fishing', 'fish',
  'for', 'from', 'give', 'in', 'is', 'location', 'map', 'me', 'near', 'nearby', 'of', 'on',
  'please', 'show', 'spot', 'spots', 'tell', 'the', 'to', 'what', 'where', 'which', 'zone', 'area',
  'good', 'best', 'some', 'nearby', 'beach', 'beaches', 'water', 'marine', 'port', 'harbor', 'harbour',
  'today', 'live', 'now', 'मुझे', 'बताओ', 'बताइए', 'दिखाओ', 'जगह', 'लोकेशन', 'नक्शा',
  'मछली', 'पकड़ने', 'क्षेत्र', 'पास', 'में', 'का', 'की', 'के', 'आज', 'अभी', 'गहराई',
]);

function getPlaceQuery(text: string) {
  const words = text
    .replace(/[^\p{L}\p{N},.\-\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !PLACE_STOP_WORDS.has(word.toLocaleLowerCase()));
  const query = words.join(' ').slice(0, 120);
  return query && !/^(ocean|sea|river|lake)$/i.test(query) ? query : null;
}

function parseCoordinates(text: string) {
  const match = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return null;
  }
  return { latitude, longitude };
}

async function geocodePlace(query: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': 'NeerAI/1.0 marine assistant map lookup' },
        signal: controller.signal,
      }
    );
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
    }>;
    const result = results[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      latitude,
      longitude,
      label: result?.display_name || query,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createOutOfScopeAnswer(question: string) {
  if (/[ऀ-ॿ]/.test(question)) {
    return 'मैं केवल समुद्र, नदियों, पानी, मछली पकड़ने, नौकाओं और marine जानकारी में मदद कर सकता हूँ।';
  }
  return 'I can help with marine and water-related topics such as oceans, rivers, fishing, boats, navigation, and water safety.';
}

function createDepthAnswer(question: string, location: string | null) {
  const place = location ? `${location} ` : 'इस जलक्षेत्र में ';
  if (/[ऀ-ॿ]/.test(question)) {
    return `${place}गहराई एक जगह से दूसरी जगह बदलती है—नौवहन चैनल, किनारे और ज्वारीय हिस्सों की गहराई अलग हो सकती है। मेरे पास verified hydrographic survey नहीं है, इसलिए मीटर में संख्या देना भरोसेमंद नहीं होगा। सटीक, मौजूदा गहराई के लिए आधिकारिक nautical chart या port survey देखें; मैप का marker केवल जगह दिखाता है, depth नहीं।`;
  }
  const englishPlace = location ? `${location}: ` : '';
  return `${englishPlace}depth varies across a waterbody; maintained navigation channels, shorelines, and tidal areas can differ substantially. I don’t have a verified hydrographic survey for this point, so a meter value would be a guess. For a precise current depth, use an official nautical chart or port survey. The map marker identifies a place, not its depth.`;
}

function createFishingZoneAnswer(question: string, location: string | null) {
  const placeText = `${question} ${location || ''}`;
  if (/\blacknow\b/i.test(placeText)) {
    return 'Lucknow is inland, so there is no nearby marine fishing zone or sea-based INCOIS PFZ. If you mean freshwater fishing, name a lake or reservoir; local access and fishing rules need to be checked separately.';
  }
  const mumbaiContext = /\bmumbai\b/i.test(placeText)
    ? 'Mumbai is on Maharashtra’s Arabian Sea coast. '
    : '';
  if (/[ऀ-ॿ]/.test(question)) {
    const place = location ? `${location} के आसपास ` : '';
    return `${place}समुद्री fishing क्षेत्र मौसम, प्रजाति और समुद्र की मौजूदा स्थिति के अनुसार बदलते हैं। NEER के पास live INCOIS Potential Fishing Zone (PFZ) feed नहीं है, इसलिए मैं किसी खास जगह या coordinate को आज का verified fishing zone नहीं बता सकता। ${location ? `मैप ${location} का सामान्य reference है, fishing point नहीं। ` : ''}आज के PFZ coordinates के लिए INCOIS की ताज़ा advisory देखें।`;
  }
  const place = location ? `For ${location}, ` : '';
  return `${mumbaiContext}${place}fishing grounds vary with season, species, and changing sea conditions. NEER has no live INCOIS Potential Fishing Zone (PFZ) feed, so I can’t label a specific spot or coordinate as today’s verified fishing zone. ${location ? 'The map marks the general place reference, not a fishing point. ' : ''}For current PFZ coordinates, check the latest INCOIS advisory.`;
}

function createFishingLocationAnswer(location: string, mapCenter: { latitude: number; longitude: number }) {
  return `For your previous fishing-zone question, the map is centered on ${location} (${mapCenter.latitude.toFixed(5)}, ${mapCenter.longitude.toFixed(5)}). This is a general place reference, not a verified offshore fishing/PFZ coordinate. I don’t have a live PFZ feed; check the latest INCOIS advisory for current fishing-zone coordinates.`;
}

function getNoKeyAnswer(question: string) {
  const asksForFishingZone = /\b(fishing\s*(zone|spot|area)|fish(ing)?\s*near|nearby\s*fishing|pfz|potential\s*fishing)\b/i.test(question);
  const asksAboutLucknow = /\blacknow\b/i.test(question);
  if (!asksForFishingZone || !asksAboutLucknow) return null;

  if (/[\u0900-\u097F]/.test(question)) {
    return 'लखनऊ समुद्र तट से दूर एक अंदरूनी शहर है, इसलिए वहाँ पास में marine fishing zone या INCOIS Potential Fishing Zone (PFZ) नहीं है। PFZ समुद्र में मछली पकड़ने के लिए तटीय इलाकों में जारी होते हैं। अगर आप freshwater fishing spot पूछ रहे हैं, तो झील/जलाशय का नाम बताइए—मैं अभी किसी जगह की अनुमति या मौजूदा fishing स्थिति verify नहीं कर सकता।';
  }

  return 'Lucknow is an inland city, so there is no nearby marine fishing zone or INCOIS Potential Fishing Zone (PFZ). PFZ advisories are for fishing along the coast. If you mean freshwater fishing, tell me the lake or reservoir you have in mind; I can’t verify current access or fishing permission here.';
}

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
    const userMessages = messages.filter((message) => message.sender === 'user');
    const lastUserMessage = userMessages.at(-1)?.text?.trim();
    if (!lastUserMessage) {
      return NextResponse.json({ error: 'A question is required' }, { status: 400 });
    }

    const priorUserMessages = userMessages.slice(0, -1);
    const previousUserMessage = priorUserMessages.at(-1)?.text?.trim() || '';
    const shortContextFollowUp =
      lastUserMessage.split(/\s+/).length <= 4 &&
      (isMapRequest(lastUserMessage) || isDepthQuestion(lastUserMessage));
    const mapQuerySource = shortContextFollowUp && previousUserMessage
      ? previousUserMessage
      : lastUserMessage;
    const mapQuery = getPlaceQuery(mapQuerySource);
    const currentLocationQuestion = asksForCurrentLocation(lastUserMessage);
    const mapRequest =
      isMapRequest(lastUserMessage) ||
      (isDepthQuestion(lastUserMessage) && Boolean(mapQuery));
    const specificDepthQuestion = isDepthQuestion(lastUserMessage);
    const fishingLocationFollowUp =
      shortContextFollowUp && isMapRequest(lastUserMessage) && isFishingZoneQuestion(previousUserMessage);
    const marineContext = shortContextFollowUp && isMarineTopic(previousUserMessage);
    const inMarineScope = isMarineTopic(lastUserMessage) || marineContext;

    const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_BACKUP]
      .map((key) => key?.trim())
      .filter((key): key is string => Boolean(key));

    const validLocation = currentLocationQuestion && body.location &&
      Number.isFinite(body.location.latitude) &&
      Number.isFinite(body.location.longitude) &&
      Math.abs(body.location.latitude) <= 90 &&
      Math.abs(body.location.longitude) <= 180
      ? body.location
      : null;

    const textCoordinates = mapRequest ? parseCoordinates(lastUserMessage) : null;
    let mapCenter = validLocation || textCoordinates;
    let locationLabel: string | null = null;
    let nearbyPlaces: NearbyPlace[] = [];
    if (mapRequest && mapCenter) {
      [locationLabel, nearbyPlaces] = await Promise.all([
        reverseGeocode(mapCenter),
        findNearbyPlaces(mapCenter),
      ]);
    } else if (mapRequest && mapQuery) {
      const result = await geocodePlace(mapQuery);
      if (result) {
        mapCenter = { latitude: result.latitude, longitude: result.longitude };
        locationLabel = result.label;
        nearbyPlaces = await findNearbyPlaces(mapCenter);
      }
    }

    const mapFields = {
      showMap: mapRequest && Boolean(mapCenter),
      mapLocation: mapCenter,
      locationLabel,
      marinePoints: [] as MarinePoint[],
      nearbyPlaces,
    };

    if (!inMarineScope) {
      return NextResponse.json({ answer: `NEER AI: ${createOutOfScopeAnswer(lastUserMessage)}`, ...mapFields });
    }

    if (specificDepthQuestion) {
      return NextResponse.json({
        answer: `NEER AI: ${createDepthAnswer(lastUserMessage, locationLabel || mapQuery)}`,
        ...mapFields,
      });
    }

    if (fishingLocationFollowUp && mapCenter) {
      return NextResponse.json({
        answer: `NEER AI: ${createFishingLocationAnswer(locationLabel || mapQuery || 'the requested place', mapCenter)}`,
        ...mapFields,
      });
    }

    if (isFishingZoneQuestion(lastUserMessage)) {
      return NextResponse.json({
        answer: `NEER AI: ${createFishingZoneAnswer(lastUserMessage, locationLabel || mapQuery)}`,
        ...mapFields,
      });
    }

    if (keys.length === 0) {
      const fallbackAnswer = getNoKeyAnswer(lastUserMessage);
      if (fallbackAnswer) {
        return NextResponse.json({ answer: `NEER AI: ${fallbackAnswer}`, ...mapFields });
      }

      return NextResponse.json({
        error: 'NEER AI is not connected yet. Add GEMINI_API_KEY to the Vercel project’s Environment Variables and redeploy.',
        code: 'MISSING_GEMINI_API_KEY',
      }, { status: 503 });
    }

    const mapContext = mapCenter
      ? `\nVerified map lookup: OpenStreetMap resolved the requested map center to ${locationLabel || mapQuery || 'the supplied browser location'} (${mapCenter.latitude.toFixed(5)}, ${mapCenter.longitude.toFixed(5)}). This is only a map reference. It does not verify depth, a fishing zone, weather, or live marine conditions.${nearbyPlaces.length ? ` Nearby mapped water/marine features: ${nearbyPlaces.map((place) => `${place.name} (${place.distanceKm.toFixed(2)} km)`).join(', ')}.` : ''}`
      : mapRequest
        ? '\nMap lookup note: No place could be verified from the query. Do not invent a map center or coordinates. Still answer with useful general marine information, and ask for a city, coast, or water body if a location-specific answer is needed.'
        : '';
    const contents = messages
      .filter((message) => message.text)
      .slice(-20)
      .map((message) => ({
        role: message.sender === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: message.text || '' }],
      }));
    const firstUserIndex = contents.findIndex((content) => content.role === 'user');
    if (firstUserIndex < 0) {
      return NextResponse.json({ error: 'A question is required.' }, { status: 400 });
    }
    const conversation = contents.slice(firstUserIndex);
    const latestUserIndex = conversation.map((content) => content.role).lastIndexOf('user');
    conversation[latestUserIndex].parts[0].text += mapContext;

    let answer = '';
    let lastError: unknown;
    for (const key of keys) {
      try {
        answer = await askGemini(key, conversation);
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
    return NextResponse.json({ answer: brandedAnswer, ...mapFields });
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
