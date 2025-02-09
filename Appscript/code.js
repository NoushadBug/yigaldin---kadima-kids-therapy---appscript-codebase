
PATIENTS_SHEET_NAME = "Patients"
THERAPISTS_SHEET_NAME = "Therapists"
SHORT_TERM_GOALS_SHEET = 'Short Term Goals'
LONG_TERM_GOALS_SHEET = 'Long Term Goals'

var patientsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PATIENTS_SHEET_NAME);
var therapistsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(THERAPISTS_SHEET_NAME);
var shortTermGoalsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHORT_TERM_GOALS_SHEET);

function doGet() {
    var html = HtmlService.createTemplateFromFile('C/Dashboard');
    var evaluated = html.evaluate();
    evaluated.addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return evaluated.setFaviconUrl('https://images.vexels.com/media/users/3/140003/isolated/lists/960816ac80434d43526b1968ffa415e3-contact-form-icon.png')
        .setTitle('Session Notes :: Kadima Kids Therapy');
}

function AddSignature() {
    var formName = "Add Therapist Signature";
    var template = HtmlService.createTemplateFromFile('UploadTherapistSignature');
    const therapists = getTherapistsList(); // Get therapists for select options
    template.therapists = JSON.stringify(therapists); // Pass therapists to the HTML template
    var html = template.evaluate().setTitle(formName).setSandboxMode(HtmlService.SandboxMode.IFRAME);
    html.setWidth(500).setHeight(350);
    SpreadsheetApp.getUi().showModalDialog(html, formName);
}

function getTherapistsList() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Therapists'); // Replace with the actual name of your therapist sheet
    if (!sheet) throw new Error('Therapists sheet not found.');

    const data = sheet.getDataRange().getValues();
    return data.slice(1).map(row => ({ id: row[0], name: row[1] })); // Assuming ID is column A, Name is column B
}

function uploadTherapistSignature(therapistId, fileData) {
    const folderName = "Session Note - Therapists Signatures";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const therapistSheet = ss.getSheetByName("Therapists");
    if (!therapistSheet) throw new Error('Therapists sheet not found.');

    // Locate or create the folder
    let folder;
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
        folder = folders.next();
    } else {
        folder = DriveApp.createFolder(folderName);
    }

    // Upload file
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.mimeType, fileData.name);
    const file = folder.createFile(blob);
    file.setName(`${therapistId}-${fileData.name}`);

    // Update the therapist row in the sheet
    const rows = therapistSheet.getDataRange().getValues();
    const therapistRowIndex = rows.findIndex(row => row[0].trim() === therapistId.trim());
    if (therapistRowIndex === -1) throw new Error('Therapist not found.');

    therapistSheet.getRange(therapistRowIndex + 1, 6).setValue(file.getId()); // Column F (6th column)
    return { success: true, message: 'Signature uploaded successfully!' };
}



function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function login(email, password) {
    // Check admin credentials first
    if (isAdminLogin(email, password)) {
        return {
            id: "admin",
            name: "Administrator",
            email: email
        };
    }

    // Check therapist credentials
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

function getTherapists() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(THERAPISTS_SHEET_NAME);
    if (!sheet) throw new Error('Sheet "Therapists" not found.');
    return sheet.getDataRange().getValues().slice(1); // Exclude header row
}

function savePatient(patientData) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Sheets
    const patientSheet = ss.getSheetByName(PATIENTS_SHEET_NAME);
    if (!patientSheet) throw new Error(`Sheet "${PATIENTS_SHEET_NAME}" not found.`);

    const shortTermSheet = ss.getSheetByName(SHORT_TERM_GOALS_SHEET);
    if (!shortTermSheet) throw new Error(`Sheet "${SHORT_TERM_GOALS_SHEET}" not found.`);

    // 1. Generate new Patient ID
    const lastPatientRow = patientSheet.getLastRow();
    const lastPatientId = lastPatientRow > 1 ? patientSheet.getRange(lastPatientRow, 1).getValue() : "P0";
    const newPatientId = "P" + (parseInt(lastPatientId.replace("P", ""), 10) + 1);

    // 2. Format DOB (MM/DD/YYYY)
    const dob = new Date(patientData.dob);
    const formattedDob = Utilities.formatDate(dob, Session.getScriptTimeZone(), "MM/dd/yyyy");

    // 3. Prepare row data for Patients Sheet
    const patientRow = [
        newPatientId,
        patientData.name,
        patientData.email,
        formattedDob,
        patientData.subjective,
        patientData.objective,
        patientData.otherNotes,
        patientData.assignedTherapists.join(","), // Comma-separated therapist IDs
        "Active" // Status field
    ];
    patientSheet.appendRow(patientRow);

    // 4. Handle Short-Term Goals
    const longTermGoalHeaders = shortTermSheet.getRange(1, 2, 1, shortTermSheet.getLastColumn() - 1).getValues()[0]; // Get all headers except "Patient ID"
    const row = Array(longTermGoalHeaders.length + 1).fill(""); // Create empty row matching column length
    row[0] = newPatientId; // First column is Patient ID

    // Organize goals by Long-Term Goal
    const goalsByLongTerm = {};

    // Group short-term goals under their corresponding long-term goals
    patientData.shortTermGoals.forEach((goalGroup) => {
        if (!goalsByLongTerm[goalGroup.longTermGoal]) {
            goalsByLongTerm[goalGroup.longTermGoal] = [];
        }
        goalsByLongTerm[goalGroup.longTermGoal].push(...goalGroup.goals);
    });

    // Write goals into the appropriate columns
    for (const [longTermGoal, goals] of Object.entries(goalsByLongTerm)) {
        const longTermGoalIndex = longTermGoalHeaders.indexOf(longTermGoal); // Match long-term goal ID with headers
        if (longTermGoalIndex !== -1) {
            // Format each goal with a numbered list
            row[longTermGoalIndex + 1] = goals.map((goal, index) => `${index + 1}. ${goal}`).join("\n");
        }
    }


    // 5. Append the row to Short-Term Goals Sheet
    shortTermSheet.appendRow(row);

    return { success: true, message: `Patient ${newPatientId} saved successfully!` };
}



function isAdminLogin(email, password) {
    const adminUsername = getSettingValue("Admin Username");
    const adminPassword = getSettingValue("Admin Password");

    return email.trim() === adminUsername.trim() && password.trim() === adminPassword.trim();
}



function getPatients(therapistId) {
    SpreadsheetApp.flush();
    const data = patientsSheet.getDataRange().getValues();

    // Skip header row
    const patients = data.slice(1).map(row => ({
        id: row[0],        // ID
        name: row[1],      // Patient Name
        assignedTherapists: row[7] ? row[7].split(',').map(id => id.trim()) : [] // Split and trim therapist IDs
    }));

    // If therapistId is provided, filter patients; otherwise, return all
    if (therapistId && therapistId.trim() !== '') {
        return patients.filter(patient =>
            patient.assignedTherapists.includes(therapistId.trim())
        );
    }

    return patients; // Return all patients if no therapistId is provided
}

function loadPatientData(patientID) {
    SpreadsheetApp.flush();
    if (!patientID) return; // If no patient is selected, return early

    const patientsData = patientsSheet.getRange("A2:I").getDisplayValues(); // Retrieve all patient data
    const goalsData = shortTermGoalsSheet.getRange("A1:G").getDisplayValues(); // Retrieve all short-term goals data
    const goalHeaders = goalsData[0]; // The first row in the "Short Term Goals" sheet are the headers (LT1, LT2, etc.)

    // Find the patient data based on patientID
    const patientRow = patientsData.find(row => row[0] === patientID);

    if (!patientRow) {
        console.log('Patient not found');
        return;
    }

    const patient = {
        id: patientRow[0],            // ID
        name: patientRow[1],          // Patient Name
        email: patientRow[2],         // Email
        dob: patientRow[3],           // DOB
        subjective: patientRow[4],    // Subjective
        objective: patientRow[5],     // Objective
        other: patientRow[6],         // Other Notes
        assignedTherapists: patientRow[7] ? patientRow[7].split(',').map(id => id.trim()) : [], // Therapists
        status: patientRow[8],        // Status
    };

    // Find the short-term goals for this patient
    const goalsRow = goalsData.find(row => row[0] === patientID);
    if (goalsRow) {
        // Initialize shortTermGoals array
        patient.shortTermGoals = goalHeaders.slice(1).map((header, index) => {
            const goalValue = goalsRow[index + 1]; // Get the goal value for the respective long-term goal column
            const goals = goalValue
                ? goalValue.trim().split('\n').map(goal => goal.replace(/^\d+\.\s*/, '').trim()) // Remove numbering (e.g., "1. ") and trim
                : []; // Split goals by new line and remove any leading numbering

            return {
                longTermGoal: header, // Set the long-term goal name (e.g., LT1, LT2)
                goals: goals // Set the list of goals
            };
        });
    } else {
        patient.shortTermGoals = []; // No goals found, initialize as empty
    }

    console.log(patient);
    return patient;
}

function updatePatient(updatedPatient) {
    if (!updatedPatient || !updatedPatient.id) {
        throw new Error("Invalid patient data.");
    }

    const goalsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Short Term Goals");
    const goalsData = goalsSheet.getRange("A1:G").getValues(); // Retrieve all short-term goals data
    const goalHeaders = goalsData[0]; // The first row contains the headers (LT1, LT2, etc.)
    const patientID = updatedPatient.id;

    // Find the row corresponding to the patient's ID
    const patientRowIndex = goalsData.findIndex(row => row[0] === patientID);
    if (patientRowIndex === -1) {
        throw new Error(`Patient with ID ${patientID} not found in Short Term Goals sheet.`);
    }

    // Build the new row data for the patient
    const updatedGoalsRow = [patientID]; // Start with the patient ID in column A
    goalHeaders.slice(1).forEach(header => {
        const goalGroup = updatedPatient.shortTermGoals.find(goal => goal.longTermGoal === header);
        if (goalGroup && goalGroup.goals.length > 0) {
            const numberedGoals = goalGroup.goals.map((goal, index) => `${index + 1}. ${goal}`); // Add numbering
            updatedGoalsRow.push(numberedGoals.join("\n")); // Join short-term goals with a newline
        } else {
            updatedGoalsRow.push(""); // No goals for this long-term goal
        }
    });

    // Update the patient's row in the sheet
    const range = goalsSheet.getRange(patientRowIndex + 1, 1, 1, updatedGoalsRow.length); // Row index is 1-based
    range.setValues([updatedGoalsRow]);

    return `Patient ${updatedPatient.name} (${patientID}) short-term goals updated successfully.`;
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
    SpreadsheetApp.flush()
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

    // Fetch data from LONG_TERM_GOALS_SHEET sheet
    const longTermGoalsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LONG_TERM_GOALS_SHEET);
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

function getShortTermGoalsObj(patientId, longTermGoalId) {
    SpreadsheetApp.flush();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Short Term Goals");
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) return { error: "No data available in the sheet" };

    const headers = data[0]; // First row as headers

    // Find the index of the column matching the longTermGoalId
    const longTermGoalIndex = headers.indexOf(longTermGoalId);
    if (longTermGoalIndex === -1) {
        return { error: "Invalid Long Term Goal ID" };
    }

    // Pre-process rows to find those that match the patientId
    const patientRows = data.slice(1).filter(row => row[0] === patientId);
    if (patientRows.length === 0) {
        return { error: "Patient ID not found" };
    }

    // Create a map of short-term goal IDs to their text
    const shortTermGoalsMap = {};

    // Process matching rows
    patientRows.forEach(row => {
        const goalCell = row[longTermGoalIndex]; // Get the value in the corresponding column

        if (goalCell) {
            goalCell.split("\n").forEach(goal => {
                const match = goal.match(/^(\d+). (.+)$/); // Match format "1. text"
                if (match) {
                    const id = parseInt(match[1], 10);
                    const text = match[2].trim();
                    shortTermGoalsMap[id] = { id, text }; // Map ID to an object with id and text
                }
            });
        }
    });

    return shortTermGoalsMap; // Return the mapping of short-term goal IDs to objects
}


function getShortTermGoals(patientId, longTermGoalId) {
    SpreadsheetApp.flush()

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
                const match = goal.match(/^(\d+). (.+)$/); // Match format "1. text"
                if (match) {
                    matchingGoals.push({ id: parseInt(match[1], 10), text: match[2].trim() });
                }
            });
        }
    });

    return matchingGoals; // Return the list of matching short-term goals
}

function getTherapistName(therapistId) {
    SpreadsheetApp.flush()
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Therapists");
    if (!sheet) throw new Error('Sheet "Therapists" not found.');

    const data = sheet.getDataRange().getValues(); // Fetch all rows
    for (let i = 1; i < data.length; i++) { // Skip the header row
        if (data[i][0] === therapistId) { // Column A: Therapist ID
            return data[i][1]; // Column B: Therapist Name
        }
    }

    throw new Error(`Therapist ID "${therapistId}" not found in "Therapists" sheet.`);
}

function getPatientDetails(patientId) {
    SpreadsheetApp.flush()
    const patientSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Patients");
    if (!patientSheet) throw new Error('Sheet "Patients" not found.');

    const headers = patientSheet.getDataRange().getDisplayValues()[0]; // Get column headers
    const rows = patientSheet.getDataRange().getDisplayValues().slice(1); // Skip the header row
    const patientRow = rows.find(row => row[0] === patientId); // Search for the patient by ID

    if (!patientRow) throw new Error(`Patient ID "${patientId}" not found.`);

    // Map row data to an object using headers
    return headers.reduce((obj, header, index) => {
        obj[header] = patientRow[index];
        return obj;
    }, {});
}

function getLongTermGoals() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Long Term Goals");
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) throw new Error("No Long Term Goals data available");

    const goalsMap = {};
    for (let i = 1; i < data.length; i++) { // Skip the header row
        const id = data[i][0]; // ID in column A
        const goalName = data[i][2]; // Goal Name in column C
        if (id && goalName) {
            goalsMap[id] = goalName;
        }
    }
    return goalsMap;
}

function getSettingValue(settingKey) {
    SpreadsheetApp.flush()
    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Settings");
    if (!settingsSheet) throw new Error('Sheet "Settings" not found.');

    const data = settingsSheet.getDataRange().getValues(); // Read all rows and columns
    const match = data.find(row => row[0] === settingKey); // Search column A for the key

    if (!match) throw new Error(`Setting "${settingKey}" not found in "Settings" sheet.`);
    return match[1]; // Return the value from column B
}

function moveFiles(sourceFileId, targetFolderId) {
    var file = DriveApp.getFileById(sourceFileId);
    var folder = DriveApp.getFolderById(targetFolderId);
    file.moveTo(folder);
}

function mapIdsToNames(ids, columnLetter) {
    const dropdownsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dropdowns");
    if (!dropdownsSheet) {
        throw new Error("Dropdowns sheet not found.");
    }

    // Fetch all names from the specified column
    const names = dropdownsSheet.getRange(`${columnLetter}2:${columnLetter}`).getValues()
        .flat() // Flatten into a single array
        .filter(name => name); // Remove empty rows

    // Map IDs to names
    const mappedNames = ids.map(id => names[id] || `Unknown (ID: ${id})`);
    return mappedNames;
}
function convertTo12HourFormat(time24) {
    // Split the time into hours and minutes
    const [hours24, minutes] = time24.split(":").map(Number);

    // Calculate hours for 12-hour format and determine AM/PM
    const period = hours24 >= 12 ? "PM" : "AM";
    const hours12 = hours24 % 12 || 12; // Convert 0 to 12 for midnight

    // Format the result
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function test() {
    console.log(loadPatientData("P3"))
    return
    try {
        // Open the document by ID
        const doc = DocumentApp.openById(`1Yd9wYNu2pq3739ZimGW5QcC0EUDblt4siHzU0J0T4dk`);
        const body = doc.getBody();

        // Search for the text ##segmentIndex##
        const searchResult = body.findText("##segmentIndex##");

        // Check if the text was found
        if (searchResult) {
            Logger.log("##segmentIndex## found in the document.");
            return true;
        } else {
            Logger.log("##segmentIndex## not found in the document.");
            return false;
        }
    } catch (error) {
        Logger.log("Error while checking for ##segmentIndex##: " + error.message);
        return false;
    }
}



// ##### FORM SUBMISSION CODE ##### //
// function submitForm(formData = '{"formData":{"dateOfService":"2024-12-17","patientId":"P1","placeOfServices":"Community","startTime":"15:23","endTime":"17:38","duration":"2h 15m","planOfCare":"It is recommended that treatment continue to target current goals.","verified":true,"therapistId":"T0"},"sessionData":[{"id":0,"startTime":"15:23","endTime":"16:24","longTermGoal":"LT1","shortTermGoal":"1","tailoring":["2"],"propsUsed":["4","7","1"],"levelOfSupport":"2","childCapacity":"2","outcome":"trrr","isShowing":true,"validated":true,"endTimeError":false},{"id":1,"startTime":"16:24","endTime":"17:24","longTermGoal":"LT2","shortTermGoal":"1","tailoring":["2","4","6","9","7","5"],"propsUsed":["7","3"],"levelOfSupport":"2","childCapacity":"2","outcome":"er","isShowing":true,"validated":true,"endTimeError":false},{"id":2,"startTime":"17:24","endTime":"18:24","longTermGoal":"LT2","shortTermGoal":"3","tailoring":["2"],"propsUsed":["9"],"levelOfSupport":"3","childCapacity":"0","outcome":"yrdf","isShowing":true,"validated":true,"endTimeError":false}]}') {
function submitForm(formData = '{"formData":{"dateOfService":"2024-12-19","patientId":"P1","placeOfServices":"Community","startTime":"12:26","endTime":"13:26","duration":"1h 0m","planOfCare":"It is recommended that a reevaluation is done in order to determine appropriate goals.","verified":true,"therapistId":"T0"},"sessionData":[{"id":0,"startTime":"12:26","endTime":"13:26","longTermGoal":"LT1","shortTermGoal":"1","tailoring":["0"],"propsUsed":["4"],"levelOfSupport":"1","childCapacity":"1","outcome":"planOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCareplanOfCare","isShowing":true,"validated":true,"endTimeError":false}]}') {
    try {
        const data = JSON.parse(formData);
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sessions");
        if (!sheet) throw new Error('Sheet "Sessions" not found.');

        // Generate next session ID
        const lastId = sheet.getLastRow() > 1 ? sheet.getRange(sheet.getLastRow(), 1).getValue().replace("S", "") : 0;
        const nextId = `S${parseInt(lastId, 10) + 1}`;
        var timestamp = new Date().toLocaleString()
        // Append data to the sheet
        sheet.appendRow([
            nextId,
            data.formData.patientId,
            data.formData.therapistId,
            convertTo12HourFormat(data.formData.startTime),
            convertTo12HourFormat(data.formData.endTime),
            data.formData.duration,
            data.formData.placeOfServices,
            data.formData.planOfCare,
            JSON.stringify(data.sessionData),
            "Submitted",   // Submitted → Pending → Approved/Rejected
            timestamp,
            data.formData.dateOfService
        ]);

        // Fetch patient details
        const patientDetails = getPatientDetails(data.formData.patientId);
        const therapistName = getTherapistName(data.formData.therapistId);
        var result = generateSessionDoc(formData, timestamp, nextId, patientDetails, therapistName)
        const generatedDocFileID = result.docId;
        organizeFiles(generatedDocFileID, formData, patientDetails, therapistName);
        // Update the sheet with the URL of the generated document
        const docUrl = `https://docs.google.com/document/d/${generatedDocFileID}/edit`;
        const row = sheet.createTextFinder(nextId).matchEntireCell(true).findNext().getRow();
        sheet.getRange(row, 13).setValue(docUrl);
        sendEmailAfterDocCreation(result.docId, result.timestamp);
        return `Session ${nextId} submitted successfully!`; // Success message
    } catch (error) {
        console.error("Error in submitForm:", error); // Log detailed error in the backend
        throw new Error(`Backend Error: ${error.message}`); // Pass the detailed message to the frontend
    }
}

function getTherapistSignatureFileId(therapistId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Therapists"); // Replace with your sheet name
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === therapistId) { // Assuming column A has therapist IDs
            return data[i][5]; // Assuming column F has file IDs
        }
    }
    return null; // Return null if no match is found
}


function generateSessionDoc(formData = {}, timestamp, nextId, patientDetails, therapistName) {
    try {
        const data = JSON.parse(formData);
        const { patientId, therapistId, dateOfService, placeOfServices, startTime, endTime, planOfCare } = data.formData;
        var sessionData = data.sessionData;

        // Validate sessionData
        if (!Array.isArray(sessionData) || sessionData.length === 0) {
            throw new Error("Session data is missing or invalid.");
        }

        // Fetch template ID from settings
        const templateId = getSettingValue("Document Template ID");
        const templateFile = DriveApp.getFileById(templateId);

        if (!templateFile) throw new Error("Template file not found. Check template ID in settings.");

        // Copy the template and rename it
        const newDocId = templateFile.makeCopy(`${nextId} - ${data.formData.dateOfService}`).getId();
        const doc = DocumentApp.openById(newDocId);
        var body = doc.getActiveTab().asDocumentTab().getBody();

        // Replace general placeholders in the document
        const placeholders = {
            "##clientName##": patientDetails["Patient Name"],
            "##therapistName##": therapistName,
            "##dateOfService##": dateOfService,
            "##clientDOB##": patientDetails["DOB"],
            "##placeOfServices##": placeOfServices == "Community" ? "Office" : placeOfServices,
            "##endTime##": convertTo12HourFormat(endTime),
            "##subjective##": patientDetails["Subjective"],
            "##objective##": patientDetails["Objective"],
            "##startTime##": convertTo12HourFormat(startTime),
            "##planOfCare##": planOfCare
        };

        for (const [placeholder, value] of Object.entries(placeholders)) {
            body.replaceText(placeholder, value || ""); // Replace with value or empty string
        }

        var longTermGoals = getLongTermGoals();
        // Handle sessionData for the dynamic table duplication
        sessionData.forEach((session, index) => {
            handleSessionSegment(body, patientId, session, (index + 1), longTermGoals); // Pass body, session data, and segment index
        });

        const searchResult = body.findText("##segmentIndex##");
        if (!searchResult) {
            throw new Error("Template missing ##segmentIndex## placeholder.");
        }

        // Traverse upwards to find the parent table
        let element = searchResult.getElement();
        let segmentTable = null;

        while (element) {
            if (element.getType() === DocumentApp.ElementType.TABLE) {
                segmentTable = element;
                break;
            }
            if (!element.getParent()) {
                throw new Error("Reached top of the document structure without finding a table.");
            }
            element = element.getParent();
        }
        if (segmentTable) segmentTable.removeFromParent();

        // Add "Plan of Care" and "Clinician Signature" after the table
        body.appendParagraph(`Plan of care: ${planOfCare || "No plan of care provided"}`);
        body.appendParagraph("Clinician Signature:");
        body.appendParagraph("##signature##");

        // Fetch signature image from Drive
        const signatureFileId = getTherapistSignatureFileId(therapistId); // This function gets the file ID from the F column
        if (!signatureFileId) throw new Error("Therapist signature not found.");

        const file = DriveApp.getFileById(signatureFileId);
        const signatureBlob = file.getBlob();

        // Check if the blob has a valid MIME type
        const mimeType = file.getMimeType();
        if (!mimeType || !mimeType.startsWith('image/')) {
            throw new Error("The file is not a valid image or has an invalid MIME type.");
        }

        const signatureImage = body.findText("##signature##");

        if (signatureImage) {
            const signatureElement = signatureImage.getElement();
            const parent = signatureElement.getParent();
            signatureElement.removeFromParent(); // Remove the placeholder

            // Insert the image into the document temporarily
            const tempImage = parent.asParagraph().appendInlineImage(signatureBlob);

            // Get the original dimensions of the image
            const imgWidth = tempImage.getWidth();
            const imgHeight = tempImage.getHeight();

            // Calculate aspect ratio
            const desiredWidth = 144; // 2 inches = 144 points
            const aspectRatio = imgHeight / imgWidth;
            const desiredHeight = desiredWidth * aspectRatio;

            // Set the dimensions of the inserted image
            tempImage.setWidth(desiredWidth).setHeight(desiredHeight);
        }



        doc.saveAndClose();
        return { docId: newDocId, timestamp: timestamp };
    } catch (error) {
        console.error("Error in generateSessionDoc:", error);
        throw new Error(`Failed to generate session document. Please check template and input data.: ${error.message}`);
    }
}


function handleSessionSegment(body, patientId, session, index, longTermGoals) {
    const searchResult = body.findText("##segmentIndex##");
    if (!searchResult) {
        throw new Error("Template missing ##segmentIndex## placeholder.");
    }

    // Traverse upwards to find the parent table
    let element = searchResult.getElement();
    let segmentTable = null;

    while (element) {
        if (element.getType() === DocumentApp.ElementType.TABLE) {
            segmentTable = element;
            break;
        }
        if (!element.getParent()) {
            throw new Error("Reached top of the document structure without finding a table.");
        }
        element = element.getParent();
    }

    if (!segmentTable) {
        throw new Error("Placeholder ##segmentIndex## is not inside a table.");
    }

    // Clone the table
    const clonedTable = segmentTable.copy();
    var childGrade = ''
    if (session.childCapacity == "0") {
        childGrade = "Not Present/barely"
    }
    if (session.childCapacity == "1") {
        childGrade = "Present some of the time"
    }
    if (session.childCapacity == "2") {
        childGrade = "Present most or all of the time"
    }
    const interactions = mapIdsToNames(session.tailoring, "A");
    const props = mapIdsToNames(session.propsUsed, "B");

    // Get the long-term goal name using the ID from session
    const longTermGoalName = longTermGoals[session.longTermGoal] || "Unknown Goal";
    const shortTermGoalName = getShortTermGoalsObj(patientId, session.longTermGoal)[session.shortTermGoal]['text'] || "Unknown Goal";
    const placeholders = {
        "##segmentIndex##": index,
        "##segmentStart##": convertTo12HourFormat(session.startTime),
        "##segmentEnd##": convertTo12HourFormat(session.endTime),
        "##longTermGoal##": longTermGoalName,
        "##shortTermGoal##": shortTermGoalName,
        "##minimalOrMaximum##": session.levelOfSupport === "1" ? "minimal support" : "maximum support",
        "##interactions##": interactions.join(", "), // Join tailoring array
        "##propsUsed##": props.join(", "), // Join props used array
        "##childScore##": session.childCapacity,
        "##childGrade##": childGrade,
        "##outcome##": session.outcome || "No outcome provided",
    };

    // Replace placeholders in the cloned table
    const clonedTableText = clonedTable.editAsText();
    for (const [placeholder, value] of Object.entries(placeholders)) {
        clonedTableText.replaceText(placeholder, value || ""); // Replace with value or empty string
    }

    // Append the cloned table after the original table
    body.appendTable(clonedTable);

}

function sendEmailAfterDocCreation(docId, timestamp) {
    try {
        // Retrieve the settings values
        const supervisorEmail = getSettingValue("Supervisor E-mail");
        const reviewerEmail = getSettingValue("Reviewer E-mail");
        const emailTemplate = getSettingValue("E-mail Template");

        if (!supervisorEmail || !reviewerEmail || !emailTemplate) {
            throw new Error("Supervisor Email, Reviewer Email, or Email Template is missing in the settings.");
        }

        // Get the document link
        const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

        // Replace the placeholder in the email template
        const emailBody = emailTemplate.replace("##attachmentLink##", docUrl);

        // Send the email to Supervisor and Reviewer
        const recipients = `${supervisorEmail},${reviewerEmail}`;
        const subject = `New Session Document Created - ${timestamp}`;
        MailApp.sendEmail({
            to: recipients,
            subject: subject,
            body: emailBody
        });

        console.log(`Email sent successfully to ${recipients}.`);
    } catch (error) {
        console.error("Error in sendEmailAfterDocCreation:", error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

function organizeFiles(docId, formData, patientDetails, therapistName) {
    try {
        const data = JSON.parse(formData);
        const { patientId, therapistId } = data.formData;
        var patientName = patientDetails["Patient Name"]

        // Locate or create "Session Notes" folder
        let sessionNotesFolder = DriveApp.getFoldersByName("Session Notes").hasNext()
            ? DriveApp.getFoldersByName("Session Notes").next()
            : DriveApp.createFolder("Session Notes");
        var therapistFolderName = therapistId + ": " + therapistName
        var patientFolderName = patientId + ": " + patientName

        // Locate or create therapist's folder
        let therapistFolder = sessionNotesFolder.getFoldersByName(therapistFolderName).hasNext()
            ? sessionNotesFolder.getFoldersByName(therapistFolderName).next()
            : sessionNotesFolder.createFolder(therapistFolderName);

        // Locate or create patient's folder
        let patientFolder = therapistFolder.getFoldersByName(patientFolderName).hasNext()
            ? therapistFolder.getFoldersByName(patientFolderName).next()
            : therapistFolder.createFolder(patientFolderName);

        // Locate or create subfolders for DOC and PDF
        const docFolder = patientFolder.getFoldersByName("DOC").hasNext()
            ? patientFolder.getFoldersByName("DOC").next()
            : patientFolder.createFolder("DOC");
        var docDriveFolderId = docFolder.getId();

        const pdfFolder = patientFolder.getFoldersByName("PDF").hasNext()
            ? patientFolder.getFoldersByName("PDF").next()
            : patientFolder.createFolder("PDF");

        // Get the docDriveFile from the file ID
        const docDriveFile = DriveApp.getFileById(docId);

        // Move the DOC to the DOC folder
        moveFiles(docId, docDriveFolderId);

        // Export as PDF and move to PDF folder
        const pdfBlob = docDriveFile.getAs("application/pdf");
        const pdfFile = pdfFolder.createFile(pdfBlob);

        return { docFile: docDriveFile, pdfFile };
    } catch (error) {
        console.error("Error in organizeFiles:", error);
        throw new Error(`Failed to organize files in Drive: ${error.message}`);
    }
}
