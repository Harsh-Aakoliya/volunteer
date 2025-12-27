import 'dotenv/config';

export default {
  expo: {
    name: "myapp",
    slug: "myapp",
    extra: {
      DEV_IP: process.env.DEV_IP,
      INTERNAL_IP: process.env.INTERNAL_IP,
      EXTERNAL_IP: process.env.EXTERNAL_IP,
    },
  },
};
