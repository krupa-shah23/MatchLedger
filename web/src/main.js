import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SystemPage } from "./pages/Dashboard";
import "./index.css";
const queryClient = new QueryClient();
// Auth context
const AuthContext = React.createContext(null);
// Login page
function LoginPage() {
    const [username, setUsername] = React.useState("trader1");
    const [loading, setLoading] = React.useState(false);
    const auth = React.useContext(AuthContext);
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/v1/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password: "any" }),
            });
            if (res.ok) {
                const { token, user } = await res.json();
                auth.setToken(token);
                auth.setUser(user);
            }
        }
        finally {
            setLoading(false);
        }
    };
    const quickSelect = (user) => {
        setUsername(user);
        setTimeout(() => {
            const form = document.querySelector("form");
            form?.dispatchEvent(new Event("submit", { bubbles: true }));
        }, 0);
    };
    return (<div className="login-page">
      <div className="login-card">
        <h1>MatchLedger</h1>
        <form onSubmit={handleLogin}>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" disabled={loading}/>
          <button type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="quick-buttons">
          <button onClick={() => quickSelect("trader1")}>Trader</button>
          <button onClick={() => quickSelect("risk1")}>Risk Officer</button>
          <button onClick={() => quickSelect("ops1")}>Ops Analyst</button>
          <button onClick={() => quickSelect("admin1")}>Admin</button>
        </div>
      </div>
    </div>);
}
// Trading page
function TradingPage() {
    const [symbol, setSymbol] = React.useState("ACME");
    const [side, setSide] = React.useState("BUY");
    const [quantity, setQuantity] = React.useState("100");
    const [price, setPrice] = React.useState("100.00");
    const [orders, setOrders] = React.useState([]);
    const auth = React.useContext(AuthContext);
    React.useEffect(() => {
        const fetchOrders = async () => {
            const res = await fetch("/api/v1/orders", {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                setOrders(await res.json());
            }
        };
        fetchOrders();
    }, [auth.token]);
    const handlePlace = async (e) => {
        e.preventDefault();
        const res = await fetch("/api/v1/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.token}`,
            },
            body: JSON.stringify({
                clientOrderId: `c-${Date.now()}`,
                symbol,
                side,
                type: "LIMIT",
                timeInForce: "GTC",
                quantity: parseInt(quantity),
                price,
            }),
        });
        if (res.ok) {
            const { orderId } = await res.json();
            alert(`Order placed: ${orderId}`);
        }
    };
    return (<div className="trading-page">
      <div className="trading-layout">
        <div className="order-entry">
          <h2>Place Order</h2>
          <form onSubmit={handlePlace}>
            <div>
              <label>Symbol:</label>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                <option>ACME</option>
                <option>BOBO</option>
              </select>
            </div>
            <div>
              <label>Side:</label>
              <select value={side} onChange={(e) => setSide(e.target.value)}>
                <option>BUY</option>
                <option>SELL</option>
              </select>
            </div>
            <div>
              <label>Quantity:</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}/>
            </div>
            <div>
              <label>Price:</label>
              <input type="text" value={price} onChange={(e) => setPrice(e.target.value)}/>
            </div>
            <button type="submit">Place Order</button>
          </form>
        </div>

        <div className="order-book">
          <h2>Order Book (ACME)</h2>
          <div>
            <strong>Bids:</strong>
            <div>100.00 x 100</div>
          </div>
          <div>
            <strong>Asks:</strong>
            <div>100.50 x 100</div>
          </div>
        </div>

        <div className="open-orders">
          <h2>Open Orders</h2>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (<tr key={o.orderId}>
                  <td>{o.orderId}</td>
                  <td>{o.symbol}</td>
                  <td>{o.side}</td>
                  <td>{o.quantity}</td>
                  <td>{o.price}</td>
                  <td>{o.status}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
// Portfolio page
function PortfolioPage() {
    const auth = React.useContext(AuthContext);
    const [balances, setBalances] = React.useState(null);
    React.useEffect(() => {
        const fetchBalances = async () => {
            const res = await fetch(`/api/v1/accounts/${auth.user.accountIds[0]}/balances`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                setBalances(await res.json());
            }
        };
        if (auth.user?.accountIds?.[0]) {
            fetchBalances();
        }
    }, [auth.token, auth.user]);
    return (<div className="portfolio-page">
      <h1>Portfolio</h1>
      {balances && (<div className="balance-card">
          <div>Total: ${balances.total}</div>
          <div>Held: ${balances.held}</div>
          <div>Available: ${balances.available}</div>
        </div>)}
      <div className="positions">
        <h2>Positions</h2>
        <p>No positions</p>
      </div>
    </div>);
}
// Order details page
function OrderDetailsPage() {
    const { orderId } = React.useParams();
    const auth = React.useContext(AuthContext);
    const [order, setOrder] = React.useState(null);
    const [events, setEvents] = React.useState([]);
    React.useEffect(() => {
        const fetchOrder = async () => {
            const res = await fetch(`/api/v1/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (res.ok) {
                setOrder(await res.json());
            }
            const eventsRes = await fetch(`/api/v1/orders/${orderId}/events`, {
                headers: { Authorization: `Bearer ${auth.token}` },
            });
            if (eventsRes.ok) {
                setEvents(await eventsRes.json());
            }
        };
        fetchOrder();
    }, [orderId, auth.token]);
    return (<div className="order-details-page">
      <h1>Order Details</h1>
      {order && (<div className="order-info">
          <p>Order ID: {order.orderId}</p>
          <p>Symbol: {order.symbol}</p>
          <p>Side: {order.side}</p>
          <p>Status: {order.status}</p>
        </div>)}
      <div className="events">
        <h2>Event Timeline</h2>
        {events.map((e, i) => (<div key={i} className="event">
            <strong>{e.type}</strong> @ {e.ts}
          </div>))}
      </div>
    </div>);
}
// Nav component
function Nav() {
    const auth = React.useContext(AuthContext);
    return (<nav className="navbar">
      <div className="nav-left">
        <h1>MatchLedger</h1>
        {auth.user && (<>
            <a href="/">Trading</a>
            <a href="/portfolio">Portfolio</a>
            {["RISK", "ADMIN"].includes(auth.user.role) && <a href="/risk">Risk</a>}
            {["OPS", "ADMIN"].includes(auth.user.role) && <a href="/recon">Recon</a>}
            {auth.user.role === "ADMIN" && <a href="/system">System</a>}
          </>)}
      </div>
      <div className="nav-right">
        {auth.user && (<>
            <span>{auth.user.username} ({auth.user.role})</span>
            <button onClick={() => {
                auth.setToken(null);
                auth.setUser(null);
            }}>
              Logout
            </button>
          </>)}
      </div>
    </nav>);
}
// Main App
export function App() {
    const [token, setToken] = React.useState(localStorage.getItem("token"));
    const [user, setUser] = React.useState(localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")) : null);
    React.useEffect(() => {
        if (token) {
            localStorage.setItem("token", token);
        }
        else {
            localStorage.removeItem("token");
        }
    }, [token]);
    React.useEffect(() => {
        if (user) {
            localStorage.setItem("user", JSON.stringify(user));
        }
        else {
            localStorage.removeItem("user");
        }
    }, [user]);
    const auth = {
        token,
        user,
        setToken,
        setUser,
    };
    return (<AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        {!token ? (<LoginPage />) : (<>
            <Nav />
            <Routes>
              <Route path="/" element={<TradingPage />}/>
              <Route path="/portfolio" element={<PortfolioPage />}/>
              <Route path="/orders/:orderId" element={<OrderDetailsPage />}/>
              <Route path="/system" element={<SystemPage />}/>
              <Route path="*" element={<Navigate to="/"/>}/>
            </Routes>
          </>)}
      </QueryClientProvider>
    </AuthContext.Provider>);
}
ReactDOM.createRoot(document.getElementById("root")).render(<React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>);
