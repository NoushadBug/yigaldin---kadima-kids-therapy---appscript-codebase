const SCRIPT_ID = "AKfycbyJevzM7HRJwZ5Pa506UinM4HtOJBK4UMz_ZArgEHqBS_JeZB7MgQcFpBmuqqj7JvrH5A"

async function makeApiGetRequest(action, params = {}) {
    const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
    const url = "https://script.google.com/macros/s/" + SCRIPT_ID + "/exec";
    const fullUrl = `${url}?action=${encodeURIComponent(action)}&${queryString}`;
    const options = {
        method: 'GET',
        followRedirects: true,
    };

    try {
        const response = await fetch(fullUrl, options);

        // Ensure the response is parsed as JSON
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.log(`Error during API call: ${error}`);
        throw error;
    }
}

async function makeApiPostRequest(action, payload = {}) {
    const url = `https://script.google.com/macros/s/${SCRIPT_ID}/exec`;

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: action, payload: payload }),
        redirect: 'follow', // Debug redirects
    };

    try {
        const response = await fetch(url, options);

        const responseBody = await response.text(); // Parse raw response
        console.log(responseBody);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. Response: ${responseBody}`);
        }

        return JSON.parse(responseBody); // Safely parse JSON
    } catch (error) {
        console.error(`Error during API POST call: ${error.message}`);
        console.error(error);
        throw error;
    }
}
