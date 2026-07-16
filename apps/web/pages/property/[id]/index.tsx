export const getServerSideProps = async () => ({
  redirect: {
    destination: '/dashboard',
    permanent: false
  }
});

export default function LegacyPropertyRedirect() {
  return null;
}
