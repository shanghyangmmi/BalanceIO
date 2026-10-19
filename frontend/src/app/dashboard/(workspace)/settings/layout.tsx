/**
 * Settings pages carry their own heading (PageHeading). Navigation between
 * them is the workspace sidebar; a second tab bar here used to repeat it,
 * and the company profile page repeated it a third time.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex-1">{children}</div>;
}
