# Event Request Form:

Prior Notes:
Whether you are or aren't requesting AS Funding or physical flyers, you MUST submit this request form at least 6 weeks before your event. We can create both digital and physical flyers for your event, advertise your event on social media (Facebook, Instagram, Discord), advertise your event on newsletters (IEEE, ECE, IDEA), take pictures at your event and edit them (we highly recommend this!), and livestream your event on Facebook. After submitting this form, please @-pr and/or @-coordinators in #-events on Slack.

Please note that if you submit your request late, we may deny your request.

Also note that if you're requesting AS Funding, please don't forget to check the Funding Guide or the Google Calendar for the funding request deadlines.

### Do you need graphics from our design team?

Possible Answers:

- Yes (Go to Section 2)
- No (Go to Section 3)

## Section 2: PR

If you need PR Materials, please don't forget that this form MUST be submitted at least 6 weeks in advance even if you aren't requesting AS funding or physical flyers. Also, please remember to ping PR in #-events on Slack once you've submitted this form.

### Type of material needed?

Feel free to add what else you need as well as where else you want your event advertised (if needed) in the other option.

- Digital flyer (with social media advertising: Facebook, Instagram, Discord)
- Digital flyer (with NO social media advertising)
- Physical flyer (with advertising)
- Physical flyer (with NO advertising)
- Newsletter (IEEE, ECE, IDEA)
- Other

### If you chose to have your flyer advertised, when do you need us to start advertising?

- DATETIME

### Logos Required?

[ ] IEEE
[ ] AS (required if funded by AS)
[ ] HKN
[ ] TESC
[ ] PIB
[ ] TNT
[ ] SWE
[ ] OTHER (please upload transparent logo files to the next question)

### Please share your logo files here:

FILEUPLOAD

### What format do you need it to be in?

- PNG
- PDF
- JPG
- DOES NOT MATTER

### Any other specifications and requests (color scheme, overall design, etc)? Feel free to link us to any examples you want us to consider in designing your promotional material. (i.e. past FB covers from events, etc)

TEXTBOX

### Photography Needed?

- Yes
- No

## Section 3: Event Details

Please remember to ping @Coordinators in #-events on Slack once you've submitted this form so that they can fill out a TAP form for you.

### Event Name:

TEXTBOX

### Event Description:

TEXTBOX

### Event Start Date:

DATETIME

### Event End Date:

DATETIME

### Event Location:

TEXTBOX

### Do you/will you have a room booking for this event?

- Yes
- No

## Section 4: TAP Form

Please ensure you have ALL sections completed, if something is not available, let the coordinators know and be advised on how to proceed.

### Expected attendance? Include a number NOT a range please.

(

PROGRAMMING FUNDS
EVENTS FUNDED BY PROGRAMMING FUNDS MAY ONLY ADMIT UC SAN DIEGO STUDENTS, STAFF OR FACULTY AS GUESTS.
ONLY UC SAN DIEGO UNDERGRADUATE STUDENTS MAY RECEIVE ITEMS FUNDED BY THE ASSOCIATED STUDENTS.
EVENT FUNDING IS GRANTED UP TO A MAXIMUM OF $10.00 PER EXPECTED STUDENT ATTENDEE AND $5,000 PER EVENT

)

NUMBER

### Upload your room booking here. Ensure your file size fits within this size. Please use the following naming format: EventName_LocationOfEvent_DateOfEvent

i.e. ArduinoWorkshop_Qualcomm_01/06/2025
FILEUPLOAD

### Do you need AS Funding? (food/flyers)

- Yes
- No

### Will you be serving food/drinks at your event?

- Yes
- No

## Section 5: AS Funding

Please make sure the restaurant is a valid AS Funding food vendor! An invoice can be an unofficial receipt. Just make sure that the restaurant name and location, desired pickup or delivery date and time, all the items ordered plus their prices, discount/fees/tax/tip, and total are on the invoice! We don't recommend paying out of pocket because reimbursements can be a hassle when you're not a Principal Member.

### Please put your invoice information in the following format: quantity + item name + unit cost + discounts/fees/tax/tip + total + vendor.

(e.g. 3-Chicken Cutlet with Gravy Regular, white rice, and mac salad x14.95 each | 3-Garlic Shrimp Regular with white rice and mac salad x15.45 each | 10-Spam Musubi x2.95 each | Tax = 9.35 | Tip = 18.10 | Total = 148.15 from L&L Hawaiian Barbeque)
TEXTBOX

### Be sure to share a screenshot of your order/your official food invoice here. Official food invoices will be required 2 weeks before the start of your event. Please use the following naming format: EventName_OrderLocation_DateOfEvent

i.e. QPWorkathon#1_PapaJohns_01/06/2025
FILEUPLOAD

Pocketbase Collection Schema:

```json
{
  "collectionId": "pbc_1475615553",
  "collectionName": "event_request",
  "id": "test",
  "requested_user": "RELATION_RECORD_ID",
  "name": "test",
  "location": "test",
  "start_date_time": "2022-01-01 10:00:00.123Z",
  "end_date_time": "2022-01-01 10:00:00.123Z",
  "flyers_needed": true,
  "flyer_type": [
    "digital_with_social",
    "digital_no_social",
    "physical_with_advertising",
    "physical_no_advertising",
    "newsletter",
    "other"
  ],
  "other_flyer_type": "test",
  "flyer_advertising_start_date": "test",
  "flyer_additional_requests": "test",
  "photography_needed": true,
  "required_logos": ["IEEE", "AS", "HKN", "TESC", "PIB", "TNT", "SWE", "OTHER"],
  "other_logos": ["filename.jpg"],
  "advertising_format": "pdf",
  "will_or_have_room_booking": true,
  "expected_attendance": 123,
  "room_booking": "filename.jpg",
  "as_funding_required": true,
  "food_drinks_being_served": true,
  "itemized_invoice": "JSON",
  "invoice": "filename.jpg",
  "created": "2022-01-01 10:00:00.123Z",
  "updated": "2022-01-01 10:00:00.123Z"
}
```

Possible Flyer Types:

- digital_with_social
- digital_no_social
- physical_with_advertising
- physical_no_advertising
- newsletter
- other

Possible Logos:

[ ] IEEE
[ ] AS
[ ] HKN
[ ] TESC
[ ] PIB
[ ] TNT
[ ] SWE
[ ] OTHER

Possible Advertising Formats:

- pdf
- jpeg
- png
- does_not_matter
