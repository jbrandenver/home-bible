export const getServerSideProps = async () => ({
  redirect: {
    destination: '/home-map',
    permanent: false
  }
});

export default function LegacyPropertyMapRedirect() {
  return null;
}
