#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { GymMembershipStack } from '../lib/gym-membership-stack';

const app = new cdk.App();
new GymMembershipStack(app, 'GymMembershipStack', {
  env: { account: '461340168702', region: 'ap-northeast-1' },
});
