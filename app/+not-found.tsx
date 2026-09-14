import { Redirect } from 'expo-router';
import React from 'react';

/** Any unknown path (including a hosting prefix the router doesn't know) lands on Home. */
export default function NotFoundScreen() {
  return <Redirect href="/" />;
}
