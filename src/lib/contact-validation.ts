/**
 * Contact Validation Module
 * 
 * Validates email quality (type, disposable domain detection, pattern sanity)
 * and phone formatting with area code verification.
 */

export interface ContactValidation {
    emailType: "owner" | "staff" | "generic" | "unknown";
    emailConfidence: number;     // 0.0 - 1.0
    phoneConfidence: number;     // 0.0 - 1.0
    emailFlags: string[];        // e.g. ["generic_prefix", "free_provider"]
    phoneFlags: string[];        // e.g. ["valid_ontario_area_code"]
}

// Common generic email prefixes
const GENERIC_PREFIXES = [
    "info", "contact", "hello", "office", "admin", "support",
    "sales", "enquiry", "inquiry", "mail", "team", "service",
    "general", "help", "customerservice", "reception",
];

// Disposable / throwaway email domains
const DISPOSABLE_DOMAINS = [
    "mailinator.com", "guerrillamail.com", "tempmail.com",
    "throwaway.email", "yopmail.com", "trashmail.com",
    "10minutemail.com", "fakeinbox.com", "sharklasers.com",
    "guerrillamailblock.com", "temp-mail.org", "dispostable.com",
    "maildrop.cc", "getairmail.com", "mohmal.com",
];

// Free email providers (not disposable, but lower confidence for B2B)
const FREE_PROVIDERS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "aol.com", "icloud.com", "live.com", "msn.com",
    "protonmail.com", "mail.com", "zoho.com",
    "yahoo.ca", "outlook.ca",
];

// Valid Ontario area codes
const ONTARIO_AREA_CODES = [
    "226", "249", "289", "343", "365", "382",
    "416", "437", "519", "548", "613", "647",
    "705", "742", "807", "905",
];

// Common Canadian area codes (non-Ontario)
const CANADIAN_AREA_CODES = [
    "204", "236", "250", "306", "403", "418",
    "431", "438", "450", "506", "514", "579",
    "581", "587", "604", "639", "709", "778",
    "780", "819", "825", "867", "873", "902",
];

/**
 * Validate email quality and classify type.
 */
export function validateEmail(email: string | null | undefined): {
    type: ContactValidation["emailType"];
    confidence: number;
    flags: string[];
} {
    if (!email || email.trim().length === 0) {
        return { type: "unknown", confidence: 0, flags: ["no_email"] };
    }

    const e = email.toLowerCase().trim();
    const flags: string[] = [];
    let confidence = 0.5; // Base confidence for having an email

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(e)) {
        return { type: "unknown", confidence: 0.1, flags: ["invalid_format"] };
    }

    const [localPart, domain] = e.split("@");

    // Check disposable domain
    if (DISPOSABLE_DOMAINS.includes(domain)) {
        flags.push("disposable_domain");
        return { type: "unknown", confidence: 0.05, flags };
    }

    // Check for noreply patterns
    if (localPart.includes("noreply") || localPart.includes("no-reply") || localPart.includes("donotreply")) {
        flags.push("noreply");
        return { type: "unknown", confidence: 0.05, flags };
    }

    // Determine type
    let type: ContactValidation["emailType"] = "unknown";

    // Check for generic prefixes
    const isGeneric = GENERIC_PREFIXES.some(prefix => localPart === prefix || localPart.startsWith(prefix + "."));
    if (isGeneric) {
        type = "generic";
        confidence = 0.45;
        flags.push("generic_prefix");
    }

    // Check if free provider
    const isFreeProvider = FREE_PROVIDERS.includes(domain);
    if (isFreeProvider) {
        flags.push("free_provider");
        if (!isGeneric) {
            // Personal email on free provider → likely owner
            type = "owner";
            confidence = 0.65;
        }
    }

    // Business domain email
    if (!isFreeProvider && !isGeneric) {
        // Has custom domain → likely staff/owner
        if (localPart.length <= 3 || localPart.includes(".")) {
            // Short local parts or firstname.lastname patterns
            type = "staff";
            confidence = 0.75;
        } else {
            type = "staff";
            confidence = 0.70;
        }
        flags.push("business_domain");

        // Check if local part looks like a person's name
        const namePattern = /^[a-z]+\.?[a-z]+$/;
        if (namePattern.test(localPart) && localPart.length > 3) {
            type = "owner";
            confidence = 0.80;
            flags.push("looks_like_person");
        }
    }

    // Unknown if we can't classify
    if (type === "unknown" && confidence === 0.5) {
        confidence = 0.3;
    }

    return { type, confidence, flags };
}

/**
 * Validate phone number quality.
 */
export function validatePhone(phone: string | null | undefined): {
    confidence: number;
    flags: string[];
} {
    if (!phone || phone.trim().length === 0) {
        return { confidence: 0, flags: ["no_phone"] };
    }

    const digits = phone.replace(/\D/g, "");
    const flags: string[] = [];
    let confidence = 0.3;

    // Length check
    if (digits.length < 10) {
        flags.push("too_short");
        return { confidence: 0.1, flags };
    }

    if (digits.length > 11) {
        flags.push("too_long");
        return { confidence: 0.2, flags };
    }

    // Extract area code
    let areaCode: string;
    if (digits.length === 11 && digits.startsWith("1")) {
        areaCode = digits.substring(1, 4);
    } else if (digits.length === 10) {
        areaCode = digits.substring(0, 3);
    } else {
        return { confidence: 0.3, flags: ["unusual_length"] };
    }

    // Check Ontario area code
    if (ONTARIO_AREA_CODES.includes(areaCode)) {
        confidence = 0.9;
        flags.push("valid_ontario_area_code");
    } else if (CANADIAN_AREA_CODES.includes(areaCode)) {
        confidence = 0.75;
        flags.push("valid_canadian_area_code");
    } else {
        confidence = 0.5;
        flags.push("non_local_area_code");
    }

    // Check for suspicious patterns (all same digit, sequential)
    const allSame = new Set(digits.slice(-7)).size === 1;
    if (allSame) {
        confidence = 0.1;
        flags.push("suspicious_pattern");
    }

    return { confidence, flags };
}

/**
 * Full contact validation.
 */
export function validateContact(
    email: string | null | undefined,
    phone: string | null | undefined,
): ContactValidation {
    const emailResult = validateEmail(email);
    const phoneResult = validatePhone(phone);

    return {
        emailType: emailResult.type,
        emailConfidence: emailResult.confidence,
        phoneConfidence: phoneResult.confidence,
        emailFlags: emailResult.flags,
        phoneFlags: phoneResult.flags,
    };
}
