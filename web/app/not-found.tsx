import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
export default function NotFound() { return <main className="page-container"><div className="card mx-auto my-12 max-w-xl px-7 py-16 text-center"><p className="page-eyebrow">Off the pitch · 404</p><h1 className="large-title">A little out of play.</h1><p className="mt-4 text-[12px] text-fg-muted">This page or player couldn’t be found. Your overview is a good place to start.</p><Link href="/" className="button-primary mt-7">Back to your overview<IconArrowRight /></Link></div></main>; }
