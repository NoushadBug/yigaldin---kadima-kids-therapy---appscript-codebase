const SCRIPT_ID = "AKfycbw6tVCIs0sUmjHg7u9WJdOrY5HaFoInJ_kpFr7eacPkb0eXiNtdLAPqwSSr2bOqihE8Kw";

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
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify({ action: action, payload: payload }),
        redirect: 'follow', // Debug redirects
    };

    try {
        const response = await fetch(url, options);

        const responseBody = await response.text(); // Parse raw response
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
