import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-b border-white/10 bg-[#0a0e27]">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-5 py-3">
        <span className="font-extrabold tracking-tight text-white">My FPL</span>
        <Link href="/" className="text-sm font-semibold text-gray-300 hover:text-white">
          Squad
        </Link>
        <Link href="/dashboard" className="text-sm font-semibold text-gray-300 hover:text-white">
          Dashboard
        </Link>
      </div>
    </nav>
  );
}
