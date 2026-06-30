"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import toast from "react-hot-toast";

const HEX_64_REGEX = /^[a-f0-9]{64}$/i;

function VerifyEmailInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const token = searchParams.get("token");

        if (!token || !HEX_64_REGEX.test(token)) {
            toast.error("Invalid or missing verification token.");
        } else {
            // TODO: call API here once backend is connected
            toast.success("Email verified successfully!");
        }

        router.replace("/");
    }, [router, searchParams]);

    // No UI — redirect happens on mount
    return null;
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={null}>
            <VerifyEmailInner />
        </Suspense>
    );
}