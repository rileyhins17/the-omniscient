import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCsv, sortLeadsDeterministic, CsvDialectOptions, CsvColumnDef } from "@/lib/export/csv";
import { exportPresets } from "@/lib/export/export-presets";

function sanitizeFilenamePart(val: string): string {
    return val.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getFilename(presetName: string, filters: any, format: string = "csv"): string {
    const parts = ["omniscient_export_v4", presetName];
    if (filters.tier && filters.tier.length > 0) {
        parts.push(`tier-${sanitizeFilenamePart(filters.tier.join("-"))}`);
    }
    if (filters.city) {
        parts.push(`city-${sanitizeFilenamePart(filters.city)}`);
    }
    if (filters.niche) {
        parts.push(`niche-${sanitizeFilenamePart(filters.niche)}`);
    }

    if (format !== "xlsx") {
        if (filters.delimiter === "tab") {
            parts.push("delim-tab");
        } else if (filters.delimiter === "semicolon") {
            parts.push("delim-semicolon");
        } else {
            parts.push("delim-comma");
        }
    }

    // Create format YYYY-MM-DD_HHmm based on current UTC
    const d = new Date();
    // Use ISO string: 2024-01-01T15:30:00.000Z -> 2024-01-01_1530
    const str = d.toISOString();
    const datePart = str.slice(0, 10);
    const timePart = str.slice(11, 16).replace(":", "");
    parts.push(`${datePart}_${timePart}`);

    if (format === "xlsx") return parts.join("__") + ".xlsx";
    if (filters.delimiter === "tab") return parts.join("__") + ".tsv";
    return parts.join("__") + ".csv";
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const presetName = searchParams.get("preset") || "call_sheet";

    const tierFilterStr = searchParams.get("tier");
    const tierFilter = tierFilterStr ? tierFilterStr.split(",") : ["S", "A", "B", "C"];

    const nicheFilter = searchParams.get("niche") || null;
    const cityFilter = searchParams.get("city") || null;
    const websiteStatus = searchParams.get("websiteStatus") || null;
    const hasEmail = searchParams.get("hasEmail");
    const hasPhone = searchParams.get("hasPhone");
    const includeArchived = searchParams.get("includeArchived") === "1";

    // Dialect Parameters
    const delimiterParam = searchParams.get("delimiter") || "comma";
    let delimiterStr = ",";
    if (delimiterParam === "semicolon") delimiterStr = ";";
    if (delimiterParam === "tab") delimiterStr = "\t";

    const dialectOptions: CsvDialectOptions = {
        delimiter: delimiterStr,
        quote: searchParams.get("quote") === "always" ? "always" : "minimal",
        bom: searchParams.get("bom") !== "0",
        eol: searchParams.get("eol") === "lf" ? "lf" : "crlf",
        nulls: searchParams.get("nulls") === "na" ? "na" : "blank",
        headerStyle: searchParams.get("header") === "snake" ? "snake" : "pretty",
    };

    // Columns control
    const columnsParam = searchParams.get("columns");
    const excludeParam = searchParams.get("exclude");

    try {
        const where: any = {};

        if (!includeArchived) {
            where.isArchived = false;
        }
        if (tierFilterStr) {
            where.axiomTier = { in: tierFilter };
        }
        if (nicheFilter) where.niche = nicheFilter;
        if (cityFilter) where.city = cityFilter;
        if (websiteStatus) where.websiteStatus = websiteStatus;

        const andConditions: any[] = [];
        if (hasEmail === "1") {
            andConditions.push({ email: { not: null, gt: "" } });
        } else if (hasEmail === "0") {
            andConditions.push({ OR: [{ email: null }, { email: "" }] });
        }
        if (hasPhone === "1") {
            andConditions.push({ phone: { not: null, gt: "" } });
        } else if (hasPhone === "0") {
            andConditions.push({ OR: [{ phone: null }, { phone: "" }] });
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        const leads = await prisma.lead.findMany({
            where
        });

        // Deterministic Sorting Array
        // Tier (S->A->B->C->D) then Score desc then Company asc
        sortLeadsDeterministic(leads);

        if (format === "jsonl") {
            // Retain original jsonl structure as requested not to break it
            const lines = leads.map(l => {
                let painSignalsParsed = [];
                let breakdownParsed = null;
                let assessmentParsed = null;
                try { painSignalsParsed = JSON.parse(l.painSignals || "[]"); } catch { }
                try { breakdownParsed = JSON.parse(l.scoreBreakdown || "null"); } catch { }
                try { assessmentParsed = JSON.parse(l.axiomWebsiteAssessment || "null"); } catch { }

                return JSON.stringify({
                    businessName: l.businessName,
                    city: l.city,
                    niche: l.niche,
                    phone: l.phone,
                    bestEmail: l.email,
                    axiomScore: l.axiomScore,
                    tier: l.axiomTier,
                    callOpener: l.callOpener,
                    followUpQuestion: l.followUpQuestion,
                    painSignals: painSignalsParsed,
                    scoreBreakdown: breakdownParsed,
                    website: l.websiteStatus === "ACTIVE" ? "Has Website" : "No Website",
                    websiteGrade: l.websiteGrade,
                    assessment: assessmentParsed,
                    contactName: l.contactName,
                    emailType: l.emailType,
                    emailConfidence: l.emailConfidence,
                    phoneConfidence: l.phoneConfidence,
                    lastUpdated: l.lastUpdated?.toISOString() || l.createdAt.toISOString(),
                    source: l.source,
                });
            });

            return new NextResponse(lines.join("\n"), {
                headers: {
                    "Content-Type": "application/x-ndjson",
                    "Content-Disposition": `attachment; filename="axiom_call_sheet.jsonl"`,
                },
            });
        }

        if (format === "xlsx") {
            const { generateXlsx } = await import("@/lib/export/xlsx");
            const preset = exportPresets[presetName] || exportPresets.call_sheet;

            const filtersInfo = {
                tier: tierFilterStr ? tierFilter : null,
                city: cityFilter,
                niche: nicheFilter,
            };
            const filename = getFilename(preset.name, filtersInfo, "xlsx");

            const xlsxBuffer = await generateXlsx(leads, preset.name, filtersInfo);

            return new Response(xlsxBuffer as any, {
                status: 200,
                headers: {
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
                    "Content-Length": xlsxBuffer.byteLength.toString(),
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                },
            });
        }

        // --- CSV EXPORT PRO ---
        const preset = exportPresets[presetName] || exportPresets.call_sheet;

        let targetColumns: CsvColumnDef[] | undefined = undefined;
        const warnings: string[] = [];

        if (columnsParam) {
            const requestedKeys = columnsParam.split(",").map(k => k.trim()).filter(Boolean);
            const resolved = requestedKeys.map(k => preset.columns.find(c => c.key === k)).filter(Boolean) as CsvColumnDef[];
            const missing = requestedKeys.filter(k => !preset.columns.find(c => c.key === k));

            if (missing.length > 0) {
                warnings.push(`Unknown columns ignored: ${missing.join(", ")}`);
            }
            if (resolved.length >= 3) {
                targetColumns = resolved;
            } else {
                warnings.push("Requested columns fewer than 3, falling back to preset default.");
            }
        } else if (excludeParam) {
            const excludedKeys = excludeParam.split(",").map(k => k.trim()).filter(Boolean);
            const remaining = preset.columns.filter(c => !excludedKeys.includes(c.key));
            if (remaining.length >= 3) {
                targetColumns = remaining;
            } else {
                warnings.push("Exclusions left fewer than 3 columns, falling back to preset default.");
            }
        }

        const csvContent = generateCsv(leads, preset, targetColumns, dialectOptions);

        const filtersInfo = {
            tier: tierFilterStr ? tierFilter : null,
            city: cityFilter,
            niche: nicheFilter,
            delimiter: delimiterParam
        };
        const filename = getFilename(preset.name, filtersInfo, "csv");

        const resHeaders: Record<string, string> = {
            "Content-Type": delimiterParam === "tab" ? "text/tab-separated-values; charset=utf-8" : "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
        };
        if (warnings.length > 0) {
            resHeaders["X-Export-Warn"] = warnings.join("; ");
        }

        return new NextResponse(csvContent, { headers: resHeaders });

    } catch (error: any) {
        console.error("Export error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
