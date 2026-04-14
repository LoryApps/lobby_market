-- =============================================================================
-- Lobby Market: Clout Gifting RPC
-- Allows authenticated users to send Clout to another user.
-- Uses a SECURITY DEFINER function so both debit + credit transactions
-- bypass RLS (which has no direct INSERT policy on clout_transactions).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- RPC: gift_clout(p_recipient_id, p_amount, p_reason)
-- Called server-side from /api/clout/gift.
-- Returns: JSON { status, new_balance, error? }
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION gift_clout(
  p_recipient_id  UUID,
  p_amount        INT,
  p_reason        TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id     UUID;
  v_sender_clout  INT;
  v_sender_name   TEXT;
  v_recip_name    TEXT;
  v_new_balance   INT;
BEGIN
  -- 1. Identify the calling user
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('status', 'unauthorized');
  END IF;

  -- 2. Cannot gift to yourself
  IF v_sender_id = p_recipient_id THEN
    RETURN json_build_object('status', 'self_gift');
  END IF;

  -- 3. Validate amount
  IF p_amount < 1 OR p_amount > 500 THEN
    RETURN json_build_object('status', 'invalid_amount');
  END IF;

  -- 4. Check sender balance
  SELECT clout, username
  INTO v_sender_clout, v_sender_name
  FROM profiles
  WHERE id = v_sender_id;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'sender_not_found');
  END IF;

  IF COALESCE(v_sender_clout, 0) < p_amount THEN
    RETURN json_build_object(
      'status', 'insufficient_clout',
      'balance', COALESCE(v_sender_clout, 0)
    );
  END IF;

  -- 5. Verify recipient exists
  SELECT username INTO v_recip_name
  FROM profiles WHERE id = p_recipient_id;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'recipient_not_found');
  END IF;

  -- 6. Debit sender (negative amount → trigger clamps at 0)
  INSERT INTO clout_transactions (user_id, type, amount, reason, reference_id, reference_type)
  VALUES (
    v_sender_id,
    'gifted',
    -p_amount,
    COALESCE(NULLIF(trim(p_reason), ''), 'Gift to @' || v_recip_name),
    p_recipient_id,
    'profile'
  );

  -- 7. Credit recipient
  INSERT INTO clout_transactions (user_id, type, amount, reason, reference_id, reference_type)
  VALUES (
    p_recipient_id,
    'gifted',
    p_amount,
    'Gift from @' || v_sender_name,
    v_sender_id,
    'profile'
  );

  -- 8. Return sender's updated balance
  SELECT clout INTO v_new_balance
  FROM profiles WHERE id = v_sender_id;

  RETURN json_build_object(
    'status', 'ok',
    'new_balance', COALESCE(v_new_balance, 0),
    'recipient_username', v_recip_name
  );
END;
$$;

COMMENT ON FUNCTION gift_clout IS
  'Transfers Clout from the calling user to a recipient atomically. '
  'Both ledger entries are written inside a SECURITY DEFINER context.';
