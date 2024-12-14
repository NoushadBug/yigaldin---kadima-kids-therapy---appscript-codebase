
PATIENTS_SHEET_NAME = "Patients"
THERAPISTS_SHEET_NAME = "Therapists"
var patientsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PATIENTS_SHEET_NAME);
var therapistsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(THERAPISTS_SHEET_NAME);

function setup() {
    ScriptApp.newTrigger('checkNotificationsDaily')
        .timeBased()
        .everyDays(1)
        .atHour(9)
        .create();
}

function doGet() {
    var html = HtmlService.createTemplateFromFile('C/Dashboard');
    var evaluated = html.evaluate();
    evaluated.addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return evaluated.setFaviconUrl('https://images.vexels.com/media/users/3/140003/isolated/lists/960816ac80434d43526b1968ffa415e3-contact-form-icon.png')
        .setTitle('Kadima Kids Therapy');
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function login(email, password) {
    var data = therapistsSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (data[i][2].trim() === email.trim() && String(data[i][3]).trim() === password.trim() && String(data[i][4]).trim() === "Active") {
            // Assuming the data array is in this order: [id, name, email, password, ...]
            return {
                id: data[i][0],
                name: data[i][1],
                email: data[i][2]
            };
        }
    }
    return null;
}


function getPatients(therapistId) {
    SpreadsheetApp.flush()
    const data = patientsSheet.getDataRange().getValues();

    // Skip header row and filter rows based on therapistId (column H, index 7)
    const patients = data.slice(1).filter(row => row[7].trim() === therapistId.trim()).map(row => ({
        id: row[0],        // ID
        name: row[1],      // Patient Name
    }));

    return patients; // Return the filtered list of patients
}


// Google Apps Script function to fetch goals for a specific patient
function getPatientGoals(patientId) {
    SpreadsheetApp.flush()
    const data = patientsSheet.getDataRange().getValues();

    // Find the matching patient by ID
    const patient = data.find(row => row[0] === patientId);

    if (patient) {
        return {
            shortTermGoals: patient[4]?.split(',') || [], // Short-Term Goals
            longTermGoals: patient[5]?.split(',') || [] // Long-Term Goals
        };
    } else {
        throw new Error(`Patient with ID ${patientId} not found`);
    }
}

function getDropdownData() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dropdowns");
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) return { error: "No data available in the sheet" };

    const labels = data[0]; // First row as labels
    const result = {};

    // Initialize result object with keys from labels
    labels.forEach(label => {
        result[label] = [];
    });

    // Populate data based on labels
    for (let i = 1; i < data.length; i++) {
        labels.forEach((label, index) => {
            if (data[i][index]) { // Add only non-empty values
                result[label].push(data[i][index]);
            }
        });
    }

    // Fetch data from "Long Term Goals" sheet
    const longTermGoalsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Long Term Goals");
    const longTermData = longTermGoalsSheet.getDataRange().getValues();

    if (longTermData.length < 2) return { error: "No Long Term Goals data available" };

    const longTermGoals = []; // Array to store Long Term Goal objects

    // Skip the header and populate data
    for (let i = 1; i < longTermData.length; i++) {
        const id = longTermData[i][0]; // ID in the first column
        const shortCode = longTermData[i][1]; // Long Term Short Code in the second column
        const goalName = longTermData[i][2]; // Long Term Goal Name in the third column
        
        if (id && shortCode && goalName) { // Ensure no empty values are added
            longTermGoals.push({
                id: id,
                shortCode: shortCode,
                goalName: goalName
            });
        }
    }

    // Return the structured data as an object with dropdown and long-term goals data
    return { ...result, longTermGoals: longTermGoals };
}

function getShortTermGoals(patientId, longTermGoalId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Short Term Goals");
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) return { error: "No data available in the sheet" };

    const headers = data[0]; // First row as headers
    const matchingGoals = [];

    // Find the index of the column matching the longTermGoalId
    const longTermGoalIndex = headers.indexOf(longTermGoalId);
    if (longTermGoalIndex === -1) {
        return { error: "Invalid Long Term Goal ID" };
    }

    // Pre-process the rows to find the ones that match the patientId
    // This reduces the amount of work in the loop and speeds up the process
    const patientRows = data.slice(1).filter(row => row[0] === patientId);

    if (patientRows.length === 0) {
        return { error: "Patient ID not found" };
    }

    // Process each matching row
    patientRows.forEach(row => {
        const goalCell = row[longTermGoalIndex]; // Get the value in the corresponding column

        if (goalCell) {
            // Process the cell contents and extract the goals in a single pass
            goalCell.split("\n").forEach(goal => {
                const match = goal.match(/^(\d+)〕(.+)$/); // Match format "1〕text"
                if (match) {
                    matchingGoals.push({ id: parseInt(match[1], 10), text: match[2].trim() });
                }
            });
        }
    });

    return matchingGoals; // Return the list of matching short-term goals
}



function test(){
    console.log(getShortTermGoals("P1", "LT6"))
}
