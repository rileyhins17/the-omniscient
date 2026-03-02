import ExcelJS from "exceljs";
import { Lead } from "@prisma/client";
import { buildPainSummary, formatPainReadable, formatPhoneDigits, truncateString } from "./csv";

// Helper for parsing JSON
function parseJsonSafe(jsonStr: string | null, fallback: any = null) {
    if (!jsonStr) return fallback;
    try {
        return JSON.parse(jsonStr);
    } catch {
        return fallback;
    }
}

function extractCityName(cityStr: string | null): string {
    if (!cityStr) return "";
    return cityStr.split(",")[0].trim();
}

function safeHyperlinkUrl(urlStr: string): string | undefined {
    let clean = urlStr.trim();
    if (!clean) return undefined;
    if (clean.startsWith("tel:") || clean.startsWith("mailto:")) return clean;
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "https://" + clean;
    }
    try {
        new URL(clean);
        return clean;
    } catch {
        return undefined;
    }
}

// Map of columns with their styling details
export interface XlsxColumnDef {
    header: string;
    width: number;
    wrap: boolean;
    resolve: (lead: Lead) => any;
    hyperlink?: (lead: Lead) => string | undefined;
}

export const callSheetXlsxCols: XlsxColumnDef[] = [
    { header: "Tier", width: 6, wrap: false, resolve: l => l.axiomTier || "" },
    { header: "Axiom Score", width: 10, wrap: false, resolve: l => l.axiomScore !== null ? Number(l.axiomScore) : null },
    { header: "Company", width: 28, wrap: false, resolve: l => l.businessName || "" },
    { header: "Niche", width: 18, wrap: false, resolve: l => l.niche || "" },
    { header: "City", width: 18, wrap: false, resolve: l => extractCityName(l.city) },
    { header: "Address", width: 32, wrap: true, resolve: l => l.address || "" },
    {
        header: "Phone",
        width: 16,
        wrap: false,
        resolve: l => l.phone || "",
        hyperlink: l => l.phone ? safeHyperlinkUrl(`tel:${formatPhoneDigits(l.phone)}`) : undefined
    },
    {
        header: "Email",
        width: 28,
        wrap: false,
        resolve: l => l.email || "",
        hyperlink: l => l.email ? safeHyperlinkUrl(`mailto:${l.email}`) : undefined
    },
    { header: "Website Status", width: 14, wrap: false, resolve: l => l.websiteStatus || "" },
    {
        header: "Website",
        width: 28,
        wrap: false,
        resolve: l => l.socialLink || "",
        hyperlink: l => l.socialLink ? safeHyperlinkUrl(l.socialLink) : undefined
    },
    { header: "Pain Summary", width: 40, wrap: true, resolve: l => buildPainSummary(l) },
    { header: "Pain 1", width: 42, wrap: true, resolve: l => formatPainReadable(l.painSignals)[0] || "" },
    { header: "Pain 2", width: 42, wrap: true, resolve: l => formatPainReadable(l.painSignals)[1] || "" },
    { header: "Pain 3", width: 42, wrap: true, resolve: l => formatPainReadable(l.painSignals)[2] || "" },
    { header: "Call Opener (Short)", width: 55, wrap: true, resolve: l => truncateString(l.callOpener, 180) },
    { header: "Follow-Up (Short)", width: 40, wrap: true, resolve: l => truncateString(l.followUpQuestion, 120) },
    { header: "Website Grade", width: 12, wrap: false, resolve: l => l.websiteGrade || "" },
    { header: "Top Fix 1", width: 32, wrap: true, resolve: l => parseJsonSafe(l.axiomWebsiteAssessment, {})?.topFixes?.[0] || "" },
    { header: "Top Fix 2", width: 32, wrap: true, resolve: l => parseJsonSafe(l.axiomWebsiteAssessment, {})?.topFixes?.[1] || "" },
    { header: "Top Fix 3", width: 32, wrap: true, resolve: l => parseJsonSafe(l.axiomWebsiteAssessment, {})?.topFixes?.[2] || "" },
    { header: "Call Opener (Full)", width: 75, wrap: true, resolve: l => l.callOpener || "" },
    { header: "Follow-Up (Full)", width: 55, wrap: true, resolve: l => l.followUpQuestion || "" },
    { header: "Source", width: 20, wrap: false, resolve: l => l.source || "" },
    { header: "Last Updated", width: 18, wrap: false, resolve: l => l.lastUpdated || l.createdAt },
    // Cast Lead ID to string to avoid scientific notation
    { header: "Lead ID", width: 18, wrap: false, resolve: l => String(l.id || "") }
];

export async function generateXlsx(leads: Lead[], preset: string, filters: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Omniscient v4";
    workbook.lastModifiedBy = "Omniscient v4";
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1) CALL SHEET
    const sheet = workbook.addWorksheet("Call Sheet", {
        views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
        properties: { defaultRowHeight: 20, showGridLines: false }
    });

    const definitions = callSheetXlsxCols; // Fallback to call sheet for XLSX-1

    // Define Columns
    sheet.columns = definitions.map(d => ({
        header: d.header,
        key: d.header,
        width: d.width
    }));

    // Header Styling
    const headerRow = sheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF111827" } // Dark slate (Tailwind gray-900)
        };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    });

    // Autofilter
    sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: definitions.length }
    };

    // Add Data Rows
    leads.forEach((lead, index) => {
        const isEven = index % 2 === 0;
        const rowData: any = {};
        definitions.forEach(d => {
            const val = d.resolve(lead);
            rowData[d.header] = val !== undefined && val !== null ? val : "";
        });

        const row = sheet.addRow(rowData);

        // Styling the row
        row.height = 36; // Default height for wrapped text
        row.eachCell((cell, colNumber) => {
            const def = definitions[colNumber - 1];

            // Zebra Striping
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: isEven ? "FFFFFFFF" : "FFF9FAFB" } // White / gray-50
            };

            // Alignment
            cell.alignment = {
                vertical: "top",
                wrapText: def.wrap,
                horizontal: typeof cell.value === "number" ? "right" : "left"
            };

            // Formatting
            if (def.header === "Last Updated") {
                cell.numFmt = "yyyy-mm-dd hh:mm";
            } else if (def.header === "Axiom Score") {
                cell.numFmt = "0.0";
            } else if (def.header === "Lead ID") {
                cell.numFmt = "@";
            }

            // Hyperlinks
            if (def.hyperlink && cell.value) {
                const url = def.hyperlink(lead);
                if (url) {
                    cell.value = {
                        text: String(cell.value),
                        hyperlink: url,
                        tooltip: url
                    };
                    cell.font = { color: { argb: "FF2563EB" }, underline: true }; // blue-600
                }
            }
        });
    });

    // 2) README SHEET
    const readme = workbook.addWorksheet("README");
    readme.columns = [
        { header: "Meta", width: 25 },
        { header: "Value", width: 60 }
    ];

    // Header for Readme
    readme.getRow(1).font = { bold: true };
    readme.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF333333" } };
    readme.getRow(1).getCell(1).font = { color: { argb: "FFFFFFFF" }, bold: true };
    readme.getRow(1).getCell(2).font = { color: { argb: "FFFFFFFF" }, bold: true };

    const filterObj = filters || {};
    const safeJoin = (arr: any) => Array.isArray(arr) ? arr.join(", ") : String(arr || "None");

    const metaData = [
        ["Export Timestamp", new Date().toISOString()],
        ["Preset", preset],
        ["Row Count", leads.length.toString()],
        ["Filters: Tier", safeJoin(filterObj.tier)],
        ["Filters: Niche", safeJoin(filterObj.niche)],
        ["Filters: City", safeJoin(filterObj.city)],
        ["Legend: Tier", "Axiom engine grade (S/A/B/C/D)"],
        ["Legend: Score", "Axiom engine numerical score out of 100"]
    ];

    metaData.forEach(row => readme.addRow(row));

    readme.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            row.eachCell(cell => {
                cell.alignment = { vertical: "top", wrapText: true };
            });
        }
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
}
