import{n as e}from"./rolldown-runtime-CbXtAM7H.js";import{E as t,F as n,P as r,Sn as i,U as a,Ut as o,Wt as s,in as c,tn as l,u,vt as d,wn as f}from"./vendor-icons-BVkCoZMX.js";import{t as p,u as m}from"./vendor-react-BGLbZ2gR.js";import{a as h,c as g,o as _,s as v}from"./apiClient-TmissCHi.js";import{g as y}from"./index-2i4FGPQG.js";import{o as b}from"./whatsappUtils-CvInFjkK.js";var x=e(f(),1),S=p(),C=()=>{b();let{login:e}=y(),f=m(),[p,C]=(0,x.useState)(``),[w,T]=(0,x.useState)(``),[E,D]=(0,x.useState)(!1),[O,k]=(0,x.useState)(null),[A,j]=(0,x.useState)(!1),[M,N]=(0,x.useState)(_()),[P,F]=(0,x.useState)(`checking`),[I,L]=(0,x.useState)(`Testing connection...`),[R,z]=(0,x.useState)(!1),[B,V]=(0,x.useState)(!1),[H,U]=(0,x.useState)(_()),[W,G]=(0,x.useState)(!1),K=(0,x.useCallback)(async e=>{let t=v(e||_());z(!0),F(`checking`),L(`Connecting...`);try{if((await h(t)).ok){F(`online`);let e=t.includes(`railway.app`);L(e?`Railway Cloud Online`:`Local Backend Online`)}else{F(`offline`);let e=t.includes(`railway.app`);L(e?`Railway Offline (502)`:`Local Engine Offline`)}}catch{F(`offline`),L(`Backend Offline`)}finally{z(!1)}},[]);(0,x.useEffect)(()=>{K();let e=setInterval(()=>K(),15e3);return()=>clearInterval(e)},[K]);let q=e=>{let t=g(e);U(t),N(t),G(!0),setTimeout(()=>G(!1),3e3),K(t)},J=e=>{if(e.preventDefault(),!H.trim())return;let t=g(H.trim());U(t),N(t),G(!0),setTimeout(()=>G(!1),3e3),K(t)},Y=()=>{let e=g(``);U(e),N(e),G(!0),setTimeout(()=>G(!1),3e3),K(e)},X=(e,t)=>{C(e),T(t),k(null)};return(0,S.jsxs)(`div`,{className:`login-wrapper`,children:[(0,S.jsx)(`style`,{children:`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-green {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          position: relative;
          padding: 1.5rem;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          position: relative;
          z-index: 10;
          box-sizing: border-box;
        }

        .login-header {
          padding: 1.75rem 1.5rem 1.25rem;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          text-align: center;
        }

        .login-logo {
          height: 64px;
          width: 64px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          display: inline-block;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.73rem;
          font-weight: 600;
          margin-top: 0.6rem;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        .status-pill.online {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }

        .status-pill.offline {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .status-pill.checking {
          background: #f8fafc;
          color: #475569;
          border-color: #e2e8f0;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .status-dot.online {
          background: #10b981;
          animation: pulse-green 2s infinite;
        }
        .status-dot.offline {
          background: #ef4444;
        }
        .status-dot.checking {
          background: #f59e0b;
        }

        .animated-input-group {
          margin-bottom: 1.1rem;
          text-align: left;
        }
        .animated-input-group label {
          display: block;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          margin-bottom: 0.4rem;
        }

        .input-wrapper {
          position: relative;
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
        }

        .input-icon-left {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          z-index: 5;
        }

        .animated-input {
          width: 100%;
          height: 100%;
          padding: 0 40px 0 38px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          box-sizing: border-box;
          line-height: normal;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .animated-input::placeholder {
          color: #94a3b8;
          font-size: 0.88rem;
        }
        .animated-input:focus {
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
        }

        .input-wrapper:focus-within .input-icon-left {
          color: #b91c1c;
        }

        .password-toggle-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          z-index: 5;
          padding: 0;
        }
        .password-toggle-btn:hover {
          color: #b91c1c;
        }

        .animated-submit-btn {
          width: 100%;
          height: 44px;
          background: #b91c1c;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.94rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 2px 4px rgba(185, 28, 28, 0.2);
          transition: background 0.15s ease, transform 0.05s active;
          margin-top: 0.5rem;
        }
        .animated-submit-btn:hover:not(:disabled) {
          background: #991b1b;
        }
        .animated-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.75rem 0.9rem;
          border-radius: 6px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 1.1rem;
          animation: shake 0.4s ease-in-out;
          line-height: 1.4;
          text-align: left;
        }

        .quick-fill-chip {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .quick-fill-chip:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .offline-box {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 0.75rem 0.9rem;
          margin-bottom: 1.1rem;
          color: #92400e;
          font-size: 0.8rem;
          text-align: left;
          line-height: 1.4;
        }
      `}),(0,S.jsxs)(`div`,{className:`login-card`,children:[(0,S.jsxs)(`div`,{className:`login-header`,children:[(0,S.jsx)(`img`,{src:`/app-icon.png`,alt:`Zamzam Foods App Icon`,className:`login-logo`,onError:e=>{e.target.style.display=`none`}}),(0,S.jsx)(`h1`,{style:{fontSize:`1.3rem`,fontWeight:800,color:`#0f172a`,margin:`0 0 0.25rem 0`,letterSpacing:`-0.02em`},children:`Zamzam Foods`}),(0,S.jsx)(`p`,{style:{fontSize:`0.84rem`,color:`#64748b`,margin:0},children:`Enterprise Wholesale & Route Management`}),(0,S.jsxs)(`div`,{style:{marginTop:`0.5rem`,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`8px`},children:[(0,S.jsxs)(`div`,{className:`status-pill ${P}`,children:[(0,S.jsx)(`span`,{className:`status-dot ${P}`}),(0,S.jsx)(`span`,{children:I})]}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>K(),title:`Refresh connection status`,style:{background:`transparent`,border:`none`,cursor:`pointer`,color:`#64748b`,display:`flex`,alignItems:`center`,padding:`4px`},children:(0,S.jsx)(a,{size:14,className:R?`spin`:``,style:{animation:R?`spin 1s linear infinite`:`none`}})}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>V(!B),title:`Configure Server URL`,style:{background:`transparent`,border:`none`,cursor:`pointer`,color:B?`#b91c1c`:`#64748b`,display:`flex`,alignItems:`center`,padding:`4px`},children:(0,S.jsx)(r,{size:14})})]}),B&&(0,S.jsxs)(`div`,{style:{marginTop:`0.75rem`,padding:`0.75rem`,background:`#f8fafc`,border:`1px solid #e2e8f0`,borderRadius:`6px`,textAlign:`left`},children:[(0,S.jsxs)(`div`,{style:{fontSize:`0.76rem`,fontWeight:700,color:`#334155`,marginBottom:`0.35rem`,display:`flex`,alignItems:`center`,gap:`4px`},children:[(0,S.jsx)(n,{size:13}),(0,S.jsx)(`span`,{children:`Backend API URL`})]}),(0,S.jsxs)(`form`,{onSubmit:J,style:{display:`flex`,gap:`6px`},children:[(0,S.jsx)(`input`,{type:`text`,value:H,onChange:e=>U(e.target.value),style:{flex:1,fontSize:`0.78rem`,padding:`4px 8px`,borderRadius:`4px`,border:`1px solid #cbd5e1`,outline:`none`},placeholder:`https://zamzamfood.up.railway.app/api/v1`}),(0,S.jsx)(`button`,{type:`submit`,style:{background:W?`#16a34a`:`#0f172a`,color:`white`,border:`none`,borderRadius:`4px`,padding:`4px 12px`,fontSize:`0.74rem`,fontWeight:600,cursor:`pointer`,transition:`all 0.2s ease`},children:W?`✓ Saved`:`Save`}),(0,S.jsx)(`button`,{type:`button`,onClick:Y,title:`Reset to default Railway Cloud backend`,style:{background:`#f1f5f9`,color:`#475569`,border:`1px solid #cbd5e1`,borderRadius:`4px`,padding:`4px 8px`,fontSize:`0.74rem`,fontWeight:600,cursor:`pointer`},children:`Reset`})]}),(0,S.jsxs)(`div`,{style:{marginTop:`0.5rem`,display:`flex`,gap:`6px`,flexWrap:`wrap`},children:[(0,S.jsx)(`button`,{type:`button`,onClick:()=>q(`http://127.0.0.1:8000/api/v1`),style:{background:M.includes(`127.0.0.1`)||M.includes(`localhost`)?`#dbeafe`:`#ffffff`,borderColor:M.includes(`127.0.0.1`)||M.includes(`localhost`)?`#3b82f6`:`#cbd5e1`,borderWidth:`1px`,borderStyle:`solid`,borderRadius:`4px`,padding:`3px 8px`,fontSize:`0.72rem`,fontWeight:600,cursor:`pointer`,color:`#1e293b`},children:`🏠 Local Engine (127.0.0.1:8000)`}),(0,S.jsx)(`button`,{type:`button`,onClick:()=>q(`https://zamzamfood.up.railway.app/api/v1`),style:{background:M.includes(`railway`)?`#f3e8ff`:`#ffffff`,borderColor:M.includes(`railway`)?`#9333ea`:`#cbd5e1`,borderWidth:`1px`,borderStyle:`solid`,borderRadius:`4px`,padding:`3px 8px`,fontSize:`0.72rem`,fontWeight:600,cursor:`pointer`,color:`#1e293b`},children:`☁️ Railway Cloud`})]}),W&&(0,S.jsxs)(`div`,{style:{fontSize:`0.72rem`,color:`#16a34a`,marginTop:`0.35rem`,fontWeight:600},children:[`✓ Backend API URL updated and verified: `,M]})]})]}),(0,S.jsxs)(`div`,{style:{padding:`1.5rem 1.75rem 1.75rem`},children:[O&&(0,S.jsxs)(`div`,{className:`error-banner`,children:[(0,S.jsx)(c,{size:18,style:{flexShrink:0,marginTop:`2px`}}),(0,S.jsx)(`span`,{children:O})]}),P===`offline`&&(0,S.jsxs)(`div`,{className:`offline-box`,children:[(0,S.jsxs)(`div`,{style:{fontWeight:700,marginBottom:`0.25rem`,display:`flex`,alignItems:`center`,gap:`4px`},children:[(0,S.jsx)(l,{size:15,color:`#dc2626`}),(0,S.jsx)(`span`,{children:M.includes(`railway`)?`Railway Cloud Server Offline (502)`:`Backend Engine Offline`})]}),(0,S.jsxs)(`p`,{style:{margin:`0 0 0.5rem 0`,fontSize:`0.77rem`},children:[`Cannot connect to `,(0,S.jsx)(`strong`,{children:M}),`.`]}),M.includes(`railway`)?(0,S.jsxs)(`div`,{style:{fontSize:`0.74rem`,background:`#fee2e2`,padding:`6px 8px`,borderRadius:`4px`,border:`1px solid #fecaca`,color:`#991b1b`,marginBottom:`0.5rem`},children:[`Railway Cloud returned 502 Bad Gateway (the container is offline or sleeping).`,(0,S.jsx)(`br`,{}),`Switch to your running Local Engine to continue:`]}):(0,S.jsxs)(`div`,{style:{fontSize:`0.74rem`,background:`#fef3c7`,padding:`6px 8px`,borderRadius:`4px`,border:`1px solid #fde68a`,marginBottom:`0.5rem`},children:[`• `,(0,S.jsx)(`strong`,{children:`Windows:`}),` Double-click `,(0,S.jsx)(`code`,{children:`start_zamzam_all.bat`}),` in the app folder.`,(0,S.jsx)(`br`,{}),`• `,(0,S.jsx)(`strong`,{children:`Mac/Dev:`}),` Run `,(0,S.jsx)(`code`,{children:`.venv/bin/python backend/manage.py runserver 127.0.0.1:8000`}),`.`]}),(0,S.jsxs)(`div`,{style:{display:`flex`,gap:`8px`,flexWrap:`wrap`},children:[M.includes(`railway`)?(0,S.jsx)(`button`,{type:`button`,onClick:()=>q(`http://127.0.0.1:8000/api/v1`),style:{background:`#16a34a`,color:`white`,border:`none`,borderRadius:`4px`,padding:`5px 10px`,fontSize:`0.75rem`,fontWeight:600,cursor:`pointer`},children:`✓ Switch to Local Engine`}):(0,S.jsx)(`button`,{type:`button`,onClick:()=>q(`https://zamzamfood.up.railway.app/api/v1`),style:{background:`#7c3aed`,color:`white`,border:`none`,borderRadius:`4px`,padding:`5px 10px`,fontSize:`0.75rem`,fontWeight:600,cursor:`pointer`},children:`☁️ Switch to Railway Cloud`}),(0,S.jsxs)(`button`,{type:`button`,onClick:()=>K(),style:{background:`#d97706`,color:`white`,border:`none`,borderRadius:`4px`,padding:`5px 10px`,fontSize:`0.75rem`,fontWeight:600,cursor:`pointer`,display:`inline-flex`,alignItems:`center`,gap:`4px`},children:[(0,S.jsx)(a,{size:12}),`Retry Connection`]})]})]}),(0,S.jsxs)(`form`,{onSubmit:async t=>{if(t.preventDefault(),!p.trim()||!w){k(`Please provide both username and password.`);return}try{j(!0),k(null),await e(p.trim(),w),f(`/owner`)}catch(e){e instanceof Error?e.message.includes(`connect to the Zamzam server`)||e.message.includes(`Failed to fetch`)?(F(`offline`),k(`Backend is offline. Double-click "start_zamzam_all.bat" to start your backend server, then try again.`)):e.message.toLowerCase().includes(`credential`)||e.message.toLowerCase().includes(`401`)?k(`Invalid credentials. Use default admin "admin" / "zamzam@2026".`):k(e.message):k(`Login failed. Please verify credentials.`)}finally{j(!1)}},children:[(0,S.jsxs)(`div`,{className:`animated-input-group`,children:[(0,S.jsx)(`label`,{htmlFor:`username`,children:`Username`}),(0,S.jsxs)(`div`,{className:`input-wrapper`,children:[(0,S.jsx)(`div`,{className:`input-icon-left`,children:(0,S.jsx)(u,{size:18})}),(0,S.jsx)(`input`,{id:`username`,type:`text`,className:`animated-input`,placeholder:`Enter username`,value:p,onChange:e=>C(e.target.value),disabled:A,autoComplete:`username`,autoFocus:!0})]})]}),(0,S.jsxs)(`div`,{className:`animated-input-group`,style:{marginBottom:`1.25rem`},children:[(0,S.jsx)(`label`,{htmlFor:`password`,children:`Password`}),(0,S.jsxs)(`div`,{className:`input-wrapper`,children:[(0,S.jsx)(`div`,{className:`input-icon-left`,children:(0,S.jsx)(d,{size:18})}),(0,S.jsx)(`input`,{id:`password`,type:E?`text`:`password`,className:`animated-input`,placeholder:`Enter password`,value:w,onChange:e=>T(e.target.value),disabled:A,autoComplete:`current-password`}),(0,S.jsx)(`button`,{type:`button`,className:`password-toggle-btn`,onClick:()=>D(!E),tabIndex:-1,title:E?`Hide password`:`Show password`,children:E?(0,S.jsx)(s,{size:18}):(0,S.jsx)(o,{size:18})})]})]}),(0,S.jsx)(`button`,{type:`submit`,className:`animated-submit-btn`,disabled:A,children:A?(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(`div`,{style:{width:18,height:18,border:`2px solid rgba(255,255,255,0.35)`,borderTopColor:`#ffffff`,borderRadius:`50%`,animation:`spin 0.8s linear infinite`}}),(0,S.jsx)(`span`,{children:`Signing In...`})]}):(0,S.jsxs)(S.Fragment,{children:[(0,S.jsx)(`span`,{children:`Sign In`}),(0,S.jsx)(i,{size:18})]})})]}),(0,S.jsxs)(`div`,{style:{marginTop:`1.25rem`,textAlign:`center`},children:[(0,S.jsxs)(`div`,{style:{fontSize:`0.72rem`,color:`#64748b`,fontWeight:600,marginBottom:`0.4rem`,display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`4px`},children:[(0,S.jsx)(t,{size:13,color:`#b91c1c`}),(0,S.jsx)(`span`,{children:`Quick Login Accounts:`})]}),(0,S.jsxs)(`div`,{style:{display:`flex`,gap:`8px`,justifyContent:`center`,flexWrap:`wrap`},children:[(0,S.jsxs)(`button`,{type:`button`,className:`quick-fill-chip`,onClick:()=>X(`admin`,`zamzam@2026`),title:`Log in as System Admin (admin / zamzam@2026)`,children:[`👑 `,(0,S.jsx)(`span`,{children:`admin`}),` (Master Admin)`]}),(0,S.jsxs)(`button`,{type:`button`,className:`quick-fill-chip`,onClick:()=>X(`shiyas`,`zamzam@2026`),title:`Log in as Owner (shiyas / zamzam@2026)`,children:[`👤 `,(0,S.jsx)(`span`,{children:`shiyas`}),` (Owner)`]})]})]}),(0,S.jsxs)(`div`,{style:{marginTop:`1.5rem`,paddingTop:`1rem`,borderTop:`1px solid #f1f5f9`,textAlign:`center`},children:[(0,S.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`center`,gap:`0.45rem`,marginBottom:`0.2rem`},children:[(0,S.jsx)(`strong`,{style:{fontSize:`0.82rem`,color:`#b91c1c`,letterSpacing:`0.02em`},children:`Zamzam Foods`}),(0,S.jsx)(`span`,{style:{fontSize:`0.65rem`,fontWeight:600,backgroundColor:`#fee2e2`,color:`#dc2626`,padding:`0.1rem 0.45rem`,borderRadius:`999px`,border:`1px solid #fca5a5`},children:`Server Engine`})]}),(0,S.jsx)(`p`,{style:{margin:0,fontSize:`0.72rem`,color:`#64748b`},children:`Wholesale Billing & Daily Route Dispatch System`})]})]})]})]})};export{C as LoginPage};