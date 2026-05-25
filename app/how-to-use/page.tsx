import Link from "next/link";

export default function HowToUsePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <nav className="mb-8 flex justify-between text-sm">
        <Link
          href="/"
          className="text-neutral-300 hover:text-white underline underline-offset-4"
        >
          ← Back to tool
        </Link>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          How to use this tool
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          A quick guide to running a slippage check on a prediction market.
        </p>
      </header>

      <section className="space-y-8 text-sm leading-6 text-neutral-300">
        <div>
          <h2 className="text-base font-medium text-white mb-2">
            1. Find a market
          </h2>
          <p>
            Open any market on{" "}
            <span className="font-mono text-neutral-100">polymarket.com</span>{" "}
            or{" "}
            <span className="font-mono text-neutral-100">kalshi.com</span> and
            copy its URL from your browser&apos;s address bar. For Kalshi you
            can also paste a ticker like{" "}
            <span className="font-mono text-neutral-100">KXHIGHNY-26MAY05</span>.
          </p>
        </div>

        <div>
          <h2 className="text-base font-medium text-white mb-2">
            2. Paste the URL
          </h2>
          <p>
            Drop the URL into the <span className="text-white">Market URL</span>{" "}
            field on the home page.
          </p>
        </div>

        <div>
          <h2 className="text-base font-medium text-white mb-2">
            3. Enter your budget
          </h2>
          <p>
            Put the dollar amount you&apos;d hypothetically spend into the{" "}
            <span className="text-white">Budget (USD)</span> field. The tool
            walks the live order book and calculates what you&apos;d actually
            pay — including slippage — instead of just showing the top-of-book
            price.
          </p>
        </div>

        <div>
          <h2 className="text-base font-medium text-white mb-2">
            4. (Optional) Set a slippage threshold
          </h2>
          <p>
            If you fill in <span className="text-white">Threshold (%)</span>,
            the tool will also report the maximum budget you could spend before
            slippage exceeds that percentage versus the reference price.
            Leave it blank to skip.
          </p>
        </div>

        <div>
          <h2 className="text-base font-medium text-white mb-2">
            5. Read the results
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-white">Best bid / ask / mid</span> — the
              current top of the order book.
            </li>
            <li>
              <span className="text-white">Avg price</span> — what your shares
              would actually cost on average if you swept the book with your
              budget.
            </li>
            <li>
              <span className="text-white">Slippage vs touch / mid</span> — how
              much worse your average fill is compared to the best ask and the
              mid price.
            </li>
            <li>
              <span className="text-white">Filled</span> — whether the book had
              enough depth to absorb your full budget.
            </li>
          </ul>
        </div>

        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-neutral-400">
            Tip: try the same budget on two different markets to compare
            liquidity. Thin markets blow up slippage fast — that&apos;s the
            whole point of checking before you click buy.
          </p>
        </div>
      </section>
    </main>
  );
}
