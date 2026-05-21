
Perfect — now we turn the style guide into a real Microsoft Word template structure (.dotx) that you can build once and reuse for every PageCast PDF.

Think of this as the internal blueprint of the template.

📄 PageCast Dark Template — Word File Structure

File name:

PageCast_Dark_Template_v1.dotx

This template contains:

Theme colors
Custom styles
Page layout
Header/footer system
Reusable blocks
🎨 1. Theme Colors (Word Theme)

In Word:
Design → Colors → Customize Colors → create PageCast Dark

Enter EXACT values:

Theme Slot	Name	Hex
Text/Background Dark 1	Midnight	#0F0F14
Text/Background Light 1	Reading Text	#E6E6EB
Accent 1	Story Blue	#7CC7FF
Accent 2	Dream Purple	#B69CFF
Accent 3	Warm Gold	#FFC875
Accent 4	Calm Teal	#6FE3C1
Accent 5	Soft Text	#B7B7C2
Accent 6	Muted Text	#8C8C98

Save theme as:

PageCast Dark.thmx
📐 2. Page Setup

Layout → Size → A4
Layout → Margins → Custom:

Margin	Size
Top	2.2 cm
Bottom	2.2 cm
Left	2 cm
Right	2 cm

Design → Page Color → Midnight (#0F0F14)

✍️ 3. Style System (MOST IMPORTANT)

Open Styles pane → create/modify these styles.

BODY TEXT STYLE

Style name:

PC Body

Settings:

Property	Value
Font	Inter / Segoe UI
Size	12.5 pt
Color	#E6E6EB
Line spacing	1.35
Space after	6 pt
Alignment	Justified

Set as Default paragraph style.

STORY TITLE (Book title)

Style name:

PC Title
Property	Value
Font	Playfair Display
Size	32 pt
Color	White
Spacing before	24 pt
Spacing after	18 pt
CHAPTER TITLE

Style name:

PC Chapter
Property	Value
Font	Inter SemiBold
Size	20 pt
Color	Dream Purple
Spacing before	18 pt
Spacing after	12 pt
SCENE BREAK

Style name:

PC Scene Break

Centered text:

✦ ✦ ✦
Property	Value
Size	14 pt
Color	Muted Text
Spacing before	14 pt
Spacing after	14 pt
QUOTE / CALLOUT BLOCK

Style name:

PC Quote

Format → Borders → Left border:

Width: 3 pt
Color: Dream Purple

Paragraph:

Property	Value
Italic	Yes
Left indent	0.8 cm
Color	#B7B7C2
METADATA STYLE

Style name:

PC Meta
Property	Value
Size	9.5 pt
Color	#8C8C98

Used for:

Copyright
Footer notes
Version
🔢 4. Header & Footer System

Open Header:

Right side text (PC Meta):

PageCast • Story Edition

Footer center:

Page X

Insert → Page Number → Bottom Center.

Color → Muted Text.

📦 5. Quick Insert Building Blocks

Create Quick Parts → Save to template:

Block Name	Content
PC Scene Break	✦ ✦ ✦
PC Chapter Start	Chapter Title + spacing
PC Quote Block	Pre-styled quote paragraph

This lets writers insert components fast.

🧾 6. Default Document Structure

When opening template, document should contain:

[PC Title]
Story Title

[PC Meta]
by Author Name

(blank page break)

[PC Chapter]
Chapter 1 — Title

[PC Body]
Story text begins…
🎉 Result

This template guarantees:

Consistent PageCast branding
Perfect dark PDFs
One-click export workflow


We already created Theme + Page setup. Now we finish the complete style system + reusable components.

✍️ 3. FULL PAGECAST STYLE SYSTEM (Word Styles Pane)

Open Home → Styles → Manage Styles → New Style

Create the following styles EXACTLY.

📝 BODY & STORY TEXT
3.1 PC Body (Main paragraph)

Style name:

PC Body

Settings:

Property	Value
Font	Inter / Segoe UI
Size	12.5 pt
Color	#E6E6EB
Line spacing	1.35
Space After	6 pt
Alignment	Justified

This is your default paragraph style.

Set as:

Set as Default → New documents based on template
3.2 PC Soft Text (metadata, captions)

Style name:

PC Soft Text
Property	Value
Size	10.5 pt
Color	#B7B7C2
Spacing	1.2

Used for:

Author
Reading time
Notes
Footers
3.3 PC Quote Paragraph

Style name:

PC Quote
Property	Value
Italic	Yes
Color	#B69CFF
Left indent	1 cm
Space Before/After	10 pt
Line spacing	1.4
🔠 HEADINGS SYSTEM
3.4 PC Title (Story title)

Style name:

PC Title
Property	Value
Font	Playfair Display / Georgia
Size	32 pt
Color	#FFFFFF
Spacing after	18 pt
Alignment	Center
3.5 PC Subtitle

Style name:

PC Subtitle
Property	Value
Size	14 pt
Color	#8C8C98
Alignment	Center
Spacing after	28 pt

Example:

A short bedtime story for calm nights
3.6 PC Chapter Heading

Style name:

PC Chapter
Property	Value
Size	20 pt
Bold	Yes
Color	#FFC875
Spacing before	30 pt
Spacing after	14 pt

Example:

Chapter 1 — The Silent Forest
3.7 PC Section Heading

Style name:

PC Section
Property	Value
Size	16 pt
Bold	Yes
Color	#FFFFFF
Spacing before	24 pt
Spacing after	8 pt
📦 4. SPECIAL PAGECAST BLOCKS

These make the PDFs feel “premium”.

4.1 Story Card Block (Reusable)

Insert → Text Box → Draw Text Box
Then format:

Fill:

#18181F

Outline:

No outline

Padding inside box:

Top 16 pt
Bottom 16 pt
Left 18 pt
Right 18 pt

Save as Quick Part:

Insert → Quick Parts → Save Selection → "PC Story Card"

Used for:

Intro paragraphs
Highlights
Summaries
4.2 Tip / Insight Box

Duplicate Story Card, change fill:

#22222B

Left border:

4.5 pt → #6FE3C1

Save as:

PC Insight Box
🔝 5. HEADER SYSTEM

Double-click header → create:

Left side:

PageCast

Style: PC Soft Text

Right side:
Insert → Page Number → Current Position

Color:

#8C8C98

Add bottom border line:

Color #22222B
Width 1 pt
🔻 6. FOOTER SYSTEM

Footer text:

Unlock more stories at PageCast

Style: PC Soft Text
Alignment: Center

Optional link color:

#7CC7FF
📑 7. COVER PAGE LAYOUT

Create first page:

Title → PC Title
Subtitle → PC Subtitle

Add spacing before title:

120 pt

Add a divider under subtitle:

Insert → Shapes → Line
Color:

#7CC7FF
Width 2.5 pt
Length 4 cm
Center aligned

Save as Quick Part:

PC Cover Page
💾 8. SAVE FINAL TEMPLATE

File → Save As → type:

PageCast_Dark_Template_v1.dotx

Now every new story =
File → New → Personal → PageCast Template → Write → Export PDF 🌙