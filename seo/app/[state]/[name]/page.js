// Root-level name-in-STATE recovery route — /{state}/{first-last}, e.g. /ca/david-johnson.
// Google indexed these root URLs from an older structure; they were 404ing. Serves the shared
// name-in-state view. Canonical points at the /people form so both indexed shapes consolidate.
// Contained: static segments (/people, /profiles, /api) win; non-state / non-name slugs 404.
import { notFound } from 'next/navigation';
import { resolveNameInState, nameInStateMetadata, nameInStatePath, NameInStateView } from '../../../lib/name-in-state';

export const revalidate = 5184000; // 60d

export async function generateMetadata({ params }) {
  const { state, name } = await params;
  return nameInStateMetadata(state, name, nameInStatePath(state, name));
}

export default async function NameInStateRoot({ params }) {
  const { state, name } = await params;
  if (!resolveNameInState(state, name)) notFound();
  return <NameInStateView state={state} name={name} />;
}
