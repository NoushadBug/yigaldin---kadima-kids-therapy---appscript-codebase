async function makeApiGetRequest(action, params = {}) {
    SCRIPT_ID = "AKfycbzfe5gV3RNJXJ3gQqtWm6zmdOtI0xpSsSvsHOSjeUVZ8Kf2tR2oBoJBh6HBmrxS_hn_"
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
