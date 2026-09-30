import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";


// Default metrics shape must match what InvestorMetrics.jsx expects.
// Default metrics shape must match what InvestorMetrics.jsx expects.
const DEFAULT_METRICS = {
    reportVersion: "2026.3", // Used to trigger force-updates on old DB docs
    reportTitle: "Andes Net Profits & Monthly Revenue",
    reportUpdatedOn: "May 2026",
    growthComparisonPeriod: "Q4 2025 vs Q1 2026",
    summaryPeriod: "Jan-May 2026",
    ltdPeriodNote: "LTD Period: Nov 2024 - May 2026",

    // Snapshot KPIs
    totalRevenue: 1070000,
    qoqGrowthPct: 80.3,
    arrr: 1640000,
    gmv: 1070000,

    // Revenue mix
    b2bShare: 88.7,
    b2cShare: 11.3,
    totalB2bRevenue: 416391,
    totalB2cRevenue: 53047,

    // Margin Quality
    b2cMarginPct: 67,
    b2bMarginPct: 55,

    // EBITDA snapshot
    ebitdaBreakdown: {
        monthLabel: "Feb 2026",
        revenue: 165743,
        variableCost: 76824,
        fixedCost: 93000,
        ebitda: -4081,
    },

    // Revenue streams
    revenueStreams: {
        b2c: ["Wash & Iron", "Wash & Fold", "Dry Cleaning (clothes, shoes, bags & more)"],
        b2b: ["Wash & Fold", "Wash & Iron", "Dry Cleaning"],
    },

    // Monthly trend
    monthlyRevenue: [
        { month: "Nov 2024", b2cRevenue: 5062,  b2bRevenue: 0,      totalRevenue: 5062,   b2cShare: 100,  b2bShare: 0 },
        { month: "Dec 2024", b2cRevenue: 4544,  b2bRevenue: 0,      totalRevenue: 4544,   b2cShare: 100,  b2bShare: 0 },
        { month: "Jan 2025", b2cRevenue: 2756,  b2bRevenue: 0,      totalRevenue: 2756,   b2cShare: 100,  b2bShare: 0 },
        { month: "Feb 2025", b2cRevenue: 4115,  b2bRevenue: 0,      totalRevenue: 4115,   b2cShare: 100,  b2bShare: 0 },
        { month: "Mar 2025", b2cRevenue: 3696,  b2bRevenue: 0,      totalRevenue: 3696,   b2cShare: 100,  b2bShare: 0 },
        { month: "Apr 2025", b2cRevenue: 11390, b2bRevenue: 0,      totalRevenue: 11390,  b2cShare: 100,  b2bShare: 0 },
        { month: "May 2025", b2cRevenue: 2270,  b2bRevenue: 1485,   totalRevenue: 3755,   b2cShare: 60.5, b2bShare: 39.5 },
        { month: "Jun 2025", b2cRevenue: 2089,  b2bRevenue: 0,      totalRevenue: 2089,   b2cShare: 100,  b2bShare: 0 },
        { month: "Jul 2025", b2cRevenue: 1621,  b2bRevenue: 28050,  totalRevenue: 29671,  b2cShare: 5.5,  b2bShare: 94.5 },
        { month: "Aug 2025", b2cRevenue: 2573,  b2bRevenue: 119570, totalRevenue: 122143, b2cShare: 2.1,  b2bShare: 97.9 },
        { month: "Sep 2025", b2cRevenue: 159,   b2bRevenue: 105875, totalRevenue: 106034, b2cShare: 0.15, b2bShare: 99.85 },
        { month: "Oct 2025", b2cRevenue: 408,   b2bRevenue: 56599,  totalRevenue: 57007,  b2cShare: 0.7,  b2bShare: 99.3 },
        { month: "Nov 2025", b2cRevenue: 5000,  b2bRevenue: 68491,  totalRevenue: 73491,  b2cShare: 6.8,  b2bShare: 93.2 },
        { month: "Dec 2025", b2cRevenue: 10346, b2bRevenue: 49620,  totalRevenue: 59966,  b2cShare: 17.2, b2bShare: 82.8 },
        { month: "Jan 2026", b2cRevenue: 5038,  b2bRevenue: 54123,  totalRevenue: 59161,  b2cShare: 8.5,  b2bShare: 91.5 },
        { month: "Feb 2026", b2cRevenue: 18233, b2bRevenue: 147510, totalRevenue: 165743, b2cShare: 11.0, b2bShare: 89.0 },
        { month: "Mar 2026", b2cRevenue: 15585, b2bRevenue: 102872, totalRevenue: 118457, b2cShare: 13.2, b2bShare: 86.8 },
        { month: "Apr 2026", b2cRevenue: 18911, b2bRevenue: 107166, totalRevenue: 126077, b2cShare: 15.0, b2bShare: 85.0 },
        { month: "May 2026", b2cRevenue: 0,     b2bRevenue: 114843, totalRevenue: 114843, b2cShare: 0,    b2bShare: 100 },
    ],
};

function sanitizeMetrics(data) {
    const s = { ...DEFAULT_METRICS, ...data };
    
    // Ensure nested objects are hard-sanitized against null/missing subfields
    s.ebitdaBreakdown = {
        monthLabel: String(s.ebitdaBreakdown?.monthLabel || DEFAULT_METRICS.ebitdaBreakdown.monthLabel),
        revenue: Number(s.ebitdaBreakdown?.revenue || 0),
        variableCost: Number(s.ebitdaBreakdown?.variableCost || 0),
        fixedCost: Number(s.ebitdaBreakdown?.fixedCost || 0),
        ebitda: Number(s.ebitdaBreakdown?.ebitda || 0),
    };

    s.revenueStreams = {
        b2c: Array.isArray(s.revenueStreams?.b2c) ? s.revenueStreams.b2c : DEFAULT_METRICS.revenueStreams.b2c,
        b2b: Array.isArray(s.revenueStreams?.b2b) ? s.revenueStreams.b2b : DEFAULT_METRICS.revenueStreams.b2b,
    };

    s.monthlyRevenue = (Array.isArray(s.monthlyRevenue) ? s.monthlyRevenue : DEFAULT_METRICS.monthlyRevenue).map(p => ({
        ...p,
        b2cRevenue: Number(p.b2cRevenue || 0),
        b2bRevenue: Number(p.b2bRevenue || 0),
        totalRevenue: Number(p.totalRevenue || 0),
        b2cShare: Number(p.b2cShare || 0),
        b2bShare: Number(p.b2bShare || 0),
    }));

    return s;
}

export function useInvestorMetrics() {
    const [metrics, setMetrics] = useState(DEFAULT_METRICS);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const docRef = doc(db, "company_config", "investor_dashboard");

    useEffect(() => {
        async function fetchMetrics() {
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    
                    if (data.reportVersion !== DEFAULT_METRICS.reportVersion || data.reportTitle !== DEFAULT_METRICS.reportTitle) {
                        console.log(`Upgrading investor dashboard to version ${DEFAULT_METRICS.reportVersion}...`);
                        await setDoc(docRef, DEFAULT_METRICS);
                        setMetrics(DEFAULT_METRICS);
                    } else {
                        setMetrics(sanitizeMetrics(data));
                    }
                } else {
                    await setDoc(docRef, DEFAULT_METRICS);
                    setMetrics(DEFAULT_METRICS);
                }
            } catch (error) {
                console.error("Error fetching investor metrics:", error);
            } finally {
                setLoading(false);
            }
        }
    fetchMetrics();
}, []);

    const saveMetrics = useCallback(async (nextMetrics) => {
        setIsSaving(true);
        try {
            const payload = sanitizeMetrics(nextMetrics);
            await setDoc(docRef, payload, { merge: true });
            setMetrics(payload);
        } catch (error) {
            console.error("Error saving investor metrics:", error);
        } finally {
            setIsSaving(false);
        }
    }, [docRef]);

    return { metrics, loading, isSaving, saveMetrics };
}
