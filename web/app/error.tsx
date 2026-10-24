"use client";
import Link from "next/link";
import { IconArrowRight, IconPitch } from "@/components/icons";
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="page-container animate-fade-in"><div className="card mx-auto my-12 max-w-xl px-7 py-14 text-center"><span className="insight-icon mx-auto mb-6"><IconPitch /></span><p className="page-eyebrow">A brief pause in play</p><h1 className="large-title !text-3xl">Let’s get you back in the game.</h1><p className="mx-auto mt-4 max-w-sm text-[12px] leading-6 text-fg-muted">We couldn’t load your latest data. Your saved squad is safe. Try again, or check your data connection in workspace information.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><button className="button-primary" onClick={retry}>Try again<IconArrowRight /></button><Link href="/settings" className="button-secondary">Workspace information</Link></div></div></main>;
}
