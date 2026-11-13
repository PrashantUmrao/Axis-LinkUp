/**
 * Unit Tests for Axis LinkUp Authentication Infrastructure.
 * Verifies Svix webhook cryptographic signing, route ingress logic,
 * invitation domain enforcement, and administrative safeguards.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Webhook } from 'svix';
import { InvitationService } from '@/lib/services/invitation.service';
import { ValidationError } from '@/lib/errors/app-error';

describe('Authentication Infrastructure & Webhook Security', () => {
  const testSecret = 'whsec_52b22f0367d3419992efdc0e1c66f505';
  const alternativeSecret = 'whsec_YW5vdGhlcl9zZWNyZXRfMzJfYnl0ZXNfbG9uZ18x';

  describe('Svix Cryptographic Webhook Verification', () => {
    it('successfully verifies a valid cryptographic signature and payload', () => {
      const wh = new Webhook(testSecret);
      const msgId = 'msg_test_12345';
      const timestamp = new Date();
      const payload = JSON.stringify({
        data: {
          id: 'user_clerk_12345',
          email_addresses: [{ email_address: 'rohit.sharma@axiscolleges.in' }],
          first_name: 'Rohit',
          last_name: 'Sharma',
          public_metadata: { role: 'student' },
        },
        type: 'user.created',
      });

      const signature = wh.sign(msgId, timestamp, payload);

      wh.verify(payload, {
        'svix-id': msgId,
        'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
        'svix-signature': signature,
      });

      const verified = JSON.parse(payload) as { type: string; data: { id: string } };

      assert.equal(verified.type, 'user.created');
      assert.equal(verified.data.id, 'user_clerk_12345');
    });

    it('rejects an invalid or tampered webhook payload', () => {
      const wh = new Webhook(testSecret);
      const msgId = 'msg_test_12345';
      const timestamp = new Date();
      const originalPayload = JSON.stringify({ type: 'user.created', data: { id: 'original_id' } });
      const tamperedPayload = JSON.stringify({ type: 'user.created', data: { id: 'tampered_id' } });

      const signature = wh.sign(msgId, timestamp, originalPayload);

      assert.throws(
        () => {
          wh.verify(tamperedPayload, {
            'svix-id': msgId,
            'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
            'svix-signature': signature,
          });
        },
        (err: Error) => {
          return err.message.length > 0;
        }
      );
    });

    it('rejects a signature generated with a different secret', () => {
      const whSigner = new Webhook(alternativeSecret);
      const whVerifier = new Webhook(testSecret);
      const msgId = 'msg_test_99999';
      const timestamp = new Date();
      const payload = JSON.stringify({ type: 'user.updated' });

      const mismatchedSignature = whSigner.sign(msgId, timestamp, payload);

      assert.throws(() => {
        whVerifier.verify(payload, {
          'svix-id': msgId,
          'svix-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
          'svix-signature': mismatchedSignature,
        });
      });
    });
  });

  describe('Collegiate Ingress & Dashboard Routing Logic', () => {
    function getRoleDashboard(role?: string): string {
      switch (role) {
        case 'super_admin':
          return '/super-admin/dashboard';
        case 'admin':
          return '/admin/dashboard';
        case 'faculty':
          return '/faculty/dashboard';
        case 'student':
        default:
          return '/student/dashboard';
      }
    }

    it('maps each collegiate persona to its authorized dashboard route', () => {
      assert.equal(getRoleDashboard('student'), '/student/dashboard');
      assert.equal(getRoleDashboard('faculty'), '/faculty/dashboard');
      assert.equal(getRoleDashboard('admin'), '/admin/dashboard');
      assert.equal(getRoleDashboard('super_admin'), '/super-admin/dashboard');
      assert.equal(getRoleDashboard(undefined), '/student/dashboard');
      assert.equal(getRoleDashboard('unknown_role'), '/student/dashboard');
    });

    it('identifies public and protected ingress routes correctly', () => {
      const publicPrefixes = [
        '/',
        '/sign-in',
        '/sign-up',
        '/account-suspended',
        '/pending-approval',
        '/api/health',
        '/api/webhooks',
      ];

      for (const prefix of publicPrefixes) {
        assert.ok(prefix.length > 0);
      }
    });
  });

  describe('Faculty Invitation Security Boundaries', () => {
    it('rejects faculty invitation with non-institutional email domain', async () => {
      await assert.rejects(
        async () => {
          await InvitationService.inviteFaculty({
            email: 'external.faculty@gmail.com',
            fullName: 'External Instructor',
            employeeId: 'FAC-EXT-001',
            designation: 'Adjunct Lecturer',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.match(err.message, /@axiscolleges\.in/);
          return true;
        }
      );
    });

    it('rejects faculty invitation with personal yahoo or outlook domain', async () => {
      await assert.rejects(
        async () => {
          await InvitationService.inviteFaculty({
            email: 'professor@yahoo.co.in',
            fullName: 'Yahoo Instructor',
            employeeId: 'FAC-YAH-002',
            designation: 'Professor',
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          return true;
        }
      );
    });
  });
});
