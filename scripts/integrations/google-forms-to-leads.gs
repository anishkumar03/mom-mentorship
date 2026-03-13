/**
 * Google Apps Script — Auto-send Google Form responses to your CRM Leads webhook.
 *
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Form → click the 3-dot menu → Script editor
 * 2. Paste this entire script
 * 3. Update WEBHOOK_URL with your deployed site URL
 * 4. Update API_KEY with the same value as your LEADS_WEBHOOK_KEY env var
 * 5. Update the field mapping in onFormSubmit() to match YOUR form's question titles
 * 6. Click Run → onFormSubmit (to authorize permissions)
 * 7. Go to Triggers (clock icon) → Add Trigger:
 *    - Function: onFormSubmit
 *    - Event source: From form
 *    - Event type: On form submit
 * 8. Save — every new submission will auto-create a lead in your CRM!
 */

// ─── CONFIG ───────────────────────────────────────────────────────
var WEBHOOK_URL = "https://YOUR-SITE.vercel.app/api/leads/webhook";
var API_KEY     = "YOUR_API_KEY_HERE";
// ──────────────────────────────────────────────────────────────────

function onFormSubmit(e) {
  var responses = e.response.getItemResponses();

  // Build a map of question title → answer
  var answers = {};
  for (var i = 0; i < responses.length; i++) {
    var title = responses[i].getItem().getTitle().toLowerCase().trim();
    var value = responses[i].getResponse();
    answers[title] = value;
  }

  // ─── MAP YOUR FORM FIELDS HERE ────────────────────────────────
  // Change the keys below to match your Google Form question titles exactly (lowercase).
  // Example: if your form has "Full Name", "Phone Number", "Email Address"
  var payload = {
    full_name: answers["full name"] || answers["name"] || answers["your name"] || "",
    phone:     answers["phone"] || answers["phone number"] || answers["whatsapp number"] || "",
    email:     answers["email"] || answers["email address"] || "",
    source:    "Google Forms",
    notes:     answers["message"] || answers["notes"] || answers["anything else?"] || "",
    program:   answers["program"] || answers["interested in"] || ""
  };
  // ──────────────────────────────────────────────────────────────

  if (!payload.full_name) {
    Logger.log("Skipping — no name found in submission");
    return;
  }

  var options = {
    method: "post",
    contentType: "application/json",
    headers: { "x-api-key": API_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("Webhook response: " + response.getContentText());
  } catch (err) {
    Logger.log("Webhook error: " + err.toString());
  }
}
