export const getServerSideProps = async () => ({
  redirect: {
    destination: '/sign-in',
    permanent: false
  }
});

export default function LegacyAuthRedirect() {
  return null;
}
